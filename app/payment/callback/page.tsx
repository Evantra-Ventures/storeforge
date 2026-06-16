import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { processPaidOrder } from "@/lib/payments/processPaidOrder";

type Props = {
  searchParams: {
    reference?: string;
    orderId?: string;
  };
};

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "";
}

function getTenantSlug(order: any) {
  const tenant = Array.isArray(order?.tenant) ? order.tenant[0] : order?.tenant;
  return tenant?.slug || null;
}

function getCartRedirect(order?: any) {
  const slug = getTenantSlug(order);
  return slug ? `/store/${slug}/cart` : "/cart";
}

function getTransactionId(paymentData: any) {
  const id = paymentData?.data?.id;
  return id === undefined || id === null ? null : String(id);
}

async function markCallbackFailed({
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

  await supabase
    .from("payment_splits")
    .update({
      status: "failed",
      paystack_transaction_reference: reference,
      paystack_transaction_id: transactionId,
      metadata: {
        source: "payment_callback",
        reason,
        failed_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", order.id);
}

async function markCallbackManualReview({
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
        source: "payment_callback",
        reason,
        reviewed_at: new Date().toISOString(),
        ...(metadata || {}),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", order.id);
}

export default async function PaymentCallbackPage({ searchParams }: Props) {
  const supabase = createClient();

  const reference = searchParams.reference;
  const orderId = searchParams.orderId;

  if (!reference || !orderId) {
    redirect("/cart");
  }

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      tenant:tenants (
        id,
        name,
        slug
      )
    `)
    .eq("id", orderId)
    .or(
      `checkout_session_id.eq.${reference},paystack_transaction_reference.eq.${reference}`
    )
    .maybeSingle();

  if (!order) {
    redirect("/cart");
  }

  const cartRedirect = getCartRedirect(order);

  if (order.payment_status === "paid") {
    redirect(`/order-success/${order.id}`);
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    console.error("PAYSTACK_SECRET_KEY is not configured.");
    redirect(cartRedirect);
  }

  const paystackResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(
      reference
    )}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
      cache: "no-store",
    }
  );

  const paymentData = await paystackResponse.json();
  const transactionId = getTransactionId(paymentData);

  if (
    !paystackResponse.ok ||
    !paymentData.status ||
    paymentData.data?.status !== "success"
  ) {
    await markCallbackFailed({
      supabase,
      order,
      reference,
      transactionId,
      reason: paymentData?.data?.status || "verification_failed",
    });

    redirect(cartRedirect);
  }

  const verifiedReference = paymentData.data?.reference;
  const verifiedAmount = Number(paymentData.data?.amount || 0) / 100;
  const orderAmount = Number(order.total_amount || 0);

  if (verifiedReference !== reference) {
    console.error("Paystack reference mismatch.", {
      expected: reference,
      received: verifiedReference,
    });

    await markCallbackManualReview({
      supabase,
      order,
      reference,
      transactionId,
      reason: "reference_mismatch",
      metadata: {
        expected_reference: reference,
        received_reference: verifiedReference,
      },
    });

    redirect(cartRedirect);
  }

  if (Number(verifiedAmount.toFixed(2)) !== Number(orderAmount.toFixed(2))) {
    console.error("Paystack amount mismatch.", {
      expected: orderAmount,
      received: verifiedAmount,
    });

    await markCallbackManualReview({
      supabase,
      order,
      reference,
      transactionId,
      reason: "amount_mismatch",
      metadata: {
        expected_amount: orderAmount,
        received_amount: verifiedAmount,
      },
    });

    redirect(cartRedirect);
  }

  const verifiedCurrency = normalizeCurrency(paymentData.data?.currency);
  const orderCurrency = normalizeCurrency(order.currency);

  if (verifiedCurrency && orderCurrency && verifiedCurrency !== orderCurrency) {
    console.error("Paystack currency mismatch.", {
      expected: orderCurrency,
      received: verifiedCurrency,
    });

    await markCallbackManualReview({
      supabase,
      order,
      reference,
      transactionId,
      reason: "currency_mismatch",
      metadata: {
        expected_currency: orderCurrency,
        received_currency: verifiedCurrency,
      },
    });

    redirect(cartRedirect);
  }

  const processorFeeAmount = paymentData.data?.fees
    ? Number(paymentData.data.fees) / 100
    : 0;

  await supabase
    .from("orders")
    .update({
      checkout_session_id: reference,
      paystack_transaction_reference: reference,
      paystack_transaction_id: transactionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .neq("payment_status", "paid");

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
      source: "payment_callback",
      status: paymentData.data?.status || null,
      channel: paymentData.data?.channel || null,
      gateway_response: paymentData.data?.gateway_response || null,
      paid_at: paymentData.data?.paid_at || null,
      fees: paymentData.data?.fees || null,
      authorization: paymentData.data?.authorization || null,
      customer: paymentData.data?.customer || null,
    },
  });

  if (!result.processed) {
    console.error("Payment callback order processing failed:", result.reason);

    await markCallbackManualReview({
      supabase,
      order,
      reference,
      transactionId,
      reason: result.reason || "order_processing_failed",
      metadata: {
        result,
      },
    });

    redirect(cartRedirect);
  }

  redirect(`/order-success/${order.id}`);
}