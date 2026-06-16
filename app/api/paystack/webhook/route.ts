import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processPaidOrder } from "@/lib/payments/processPaidOrder";

function safeCompareSignature(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function getEventReference(event: any) {
  return (
    event?.data?.reference ||
    event?.data?.metadata?.reference ||
    event?.data?.metadata?.order_reference ||
    null
  );
}

function getEventTransactionId(event: any) {
  const id = event?.data?.id;
  return id === undefined || id === null ? null : String(id);
}

function getEventAmount(event: any) {
  return Number(event?.data?.amount || 0) / 100;
}

function getEventProcessorFee(event: any) {
  return event?.data?.fees ? Number(event.data.fees) / 100 : 0;
}

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "";
}

async function markOrderFailed({
  supabase,
  order,
  reference,
  transactionId,
  reason,
}: {
  supabase: ReturnType<typeof createClient>;
  order: any;
  reference: string;
  transactionId: string | null;
  reason: string;
}) {
  if (order.payment_status !== "paid") {
    await supabase
      .from("orders")
      .update({
        payment_status: "failed",
        status: "cancelled",
        settlement_status: "failed",
        paystack_transaction_reference: reference,
        paystack_transaction_id: transactionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .neq("payment_status", "paid");
  }

  await supabase
    .from("payment_splits")
    .update({
      status: "failed",
      paystack_transaction_reference: reference,
      paystack_transaction_id: transactionId,
      metadata: {
        source: "paystack_webhook",
        reason,
        failed_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", order.id);
}

async function markOrderManualReview({
  supabase,
  order,
  reference,
  transactionId,
  reason,
  metadata,
}: {
  supabase: ReturnType<typeof createClient>;
  order: any;
  reference: string;
  transactionId: string | null;
  reason: string;
  metadata?: Record<string, any>;
}) {
  await supabase
    .from("orders")
    .update({
      settlement_status: "manual_review",
      paystack_transaction_reference: reference,
      paystack_transaction_id: transactionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .neq("payment_status", "paid");

  await supabase
    .from("payment_splits")
    .update({
      status: "manual_review",
      paystack_transaction_reference: reference,
      paystack_transaction_id: transactionId,
      metadata: {
        source: "paystack_webhook",
        reason,
        reviewed_at: new Date().toISOString(),
        ...(metadata || {}),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", order.id);
}

export async function POST(request: Request) {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Payment provider is not configured." },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing Paystack signature." },
        { status: 401 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (!safeCompareSignature(expectedSignature, signature)) {
      return NextResponse.json(
        { error: "Invalid Paystack signature." },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const event = JSON.parse(rawBody);

    const reference = getEventReference(event);
    const transactionId = getEventTransactionId(event);

    if (!reference) {
      return NextResponse.json({ received: true });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .or(
        `checkout_session_id.eq.${reference},paystack_transaction_reference.eq.${reference}`
      )
      .maybeSingle();

    if (orderError) {
      console.error("Webhook order lookup error:", orderError);
      return NextResponse.json({ received: true });
    }

    if (!order) {
      return NextResponse.json({ received: true });
    }

    if (event.event === "charge.failed" || event.event === "charge.abandoned") {
      await markOrderFailed({
        supabase,
        order,
        reference,
        transactionId,
        reason: event.event,
      });

      return NextResponse.json({ received: true });
    }

    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    if (order.payment_status === "paid") {
      return NextResponse.json({
        received: true,
        processed: true,
        alreadyPaid: true,
      });
    }

    const paidAmount = getEventAmount(event);
    const orderAmount = Number(order.total_amount || 0);

    if (Number(paidAmount.toFixed(2)) !== Number(orderAmount.toFixed(2))) {
      console.error("Webhook amount mismatch.", {
        orderId: order.id,
        expected: orderAmount,
        received: paidAmount,
      });

      await markOrderManualReview({
        supabase,
        order,
        reference,
        transactionId,
        reason: "amount_mismatch",
        metadata: {
          expected_amount: orderAmount,
          received_amount: paidAmount,
        },
      });

      return NextResponse.json(
        {
          received: true,
          error: "Amount mismatch. Order placed in manual review.",
        },
        { status: 409 }
      );
    }

    const eventCurrency = normalizeCurrency(event?.data?.currency);
    const orderCurrency = normalizeCurrency(order.currency);

    if (eventCurrency && orderCurrency && eventCurrency !== orderCurrency) {
      console.error("Webhook currency mismatch.", {
        orderId: order.id,
        expected: orderCurrency,
        received: eventCurrency,
      });

      await markOrderManualReview({
        supabase,
        order,
        reference,
        transactionId,
        reason: "currency_mismatch",
        metadata: {
          expected_currency: orderCurrency,
          received_currency: eventCurrency,
        },
      });

      return NextResponse.json(
        {
          received: true,
          error: "Currency mismatch. Order placed in manual review.",
        },
        { status: 409 }
      );
    }

    const processorFeeAmount = getEventProcessorFee(event);

    const { error: referenceUpdateError } = await supabase
      .from("orders")
      .update({
        checkout_session_id: reference,
        paystack_transaction_reference: reference,
        paystack_transaction_id: transactionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .neq("payment_status", "paid");

    if (referenceUpdateError) {
      console.error("Webhook reference update error:", referenceUpdateError);
    }

    const result = await processPaidOrder({
      order: {
        ...order,
        checkout_session_id: reference,
        paystack_transaction_reference: reference,
        paystack_transaction_id: transactionId,
      },
      processorFeeAmount,
      paystackReference: reference,
      paystackTransactionId: transactionId,
      paystackMetadata: {
        source: "paystack_webhook",
        event: event.event,
        channel: event?.data?.channel || null,
        gateway_response: event?.data?.gateway_response || null,
        paid_at: event?.data?.paid_at || null,
        fees: event?.data?.fees || null,
        authorization: event?.data?.authorization || null,
        customer: event?.data?.customer || null,
      },
    });

    if (!result.processed && result.reason?.includes("inventory")) {
      return NextResponse.json(
        {
          received: true,
          error: result.reason,
        },
        { status: 409 }
      );
    }

    if (!result.processed && result.reason === "Wallet credit failed.") {
      return NextResponse.json(
        {
          received: true,
          error: result.reason,
        },
        { status: 500 }
      );
    }

    if (!result.processed) {
      return NextResponse.json(
        {
          received: true,
          error: result.reason || "Order processing failed.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      received: true,
      processed: result.processed,
      alreadyPaid: result.alreadyPaid,
      walletCredited: result.walletCredited,
      settlementRecorded: result.settlementRecorded,
    });
  } catch (error) {
    console.error("Paystack webhook processing failed:", error);

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}