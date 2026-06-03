import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processPaidOrder } from "@/lib/payments/processPaidOrder";

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

    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      return NextResponse.json(
        { error: "Invalid Paystack signature." },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const event = JSON.parse(rawBody);
    const reference = event?.data?.reference;

    if (!reference) {
      return NextResponse.json({ received: true });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("checkout_session_id", reference)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ received: true });
    }

    if (event.event === "charge.failed" || event.event === "charge.abandoned") {
      if (order.payment_status !== "paid") {
        await supabase
          .from("orders")
          .update({
            payment_status: "failed",
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);
      }

      return NextResponse.json({ received: true });
    }

    if (event.event !== "charge.success") {
      return NextResponse.json({ received: true });
    }

    const paidAmount = Number(event?.data?.amount || 0) / 100;
    const orderAmount = Number(order.total_amount || 0);

    if (Number(paidAmount.toFixed(2)) !== Number(orderAmount.toFixed(2))) {
      console.error("Webhook amount mismatch.", {
        orderId: order.id,
        expected: orderAmount,
        received: paidAmount,
      });

      await supabase
        .from("orders")
        .update({
          payment_status: "payment_review",
          status: "payment_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .neq("payment_status", "paid");

      return NextResponse.json(
        {
          received: true,
          error: "Amount mismatch. Order placed in payment review.",
        },
        { status: 409 }
      );
    }

    const processorFeeAmount = event?.data?.fees
      ? Number(event.data.fees) / 100
      : 0;

    const result = await processPaidOrder({
      order,
      processorFeeAmount,
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
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}