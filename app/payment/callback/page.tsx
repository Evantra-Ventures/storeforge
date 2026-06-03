import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { processPaidOrder } from "@/lib/payments/processPaidOrder";

type Props = {
  searchParams: {
    reference?: string;
    orderId?: string;
  };
};

export default async function PaymentCallbackPage({ searchParams }: Props) {
  const supabase = createClient();

  const reference = searchParams.reference;
  const orderId = searchParams.orderId;

  if (!reference || !orderId) {
    redirect("/cart");
  }

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("checkout_session_id", reference)
    .maybeSingle();

  if (!order) {
    redirect("/cart");
  }

  if (order.payment_status === "paid") {
    redirect(`/order-success/${order.id}`);
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    console.error("PAYSTACK_SECRET_KEY is not configured.");
    redirect("/cart");
  }

  const paystackResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
      cache: "no-store",
    }
  );

  const paymentData = await paystackResponse.json();

  if (
    !paystackResponse.ok ||
    !paymentData.status ||
    paymentData.data?.status !== "success"
  ) {
    await supabase
      .from("orders")
      .update({
        payment_status: "failed",
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .neq("payment_status", "paid");

    redirect("/cart");
  }

  const verifiedReference = paymentData.data?.reference;
  const verifiedAmount = Number(paymentData.data?.amount || 0) / 100;
  const orderAmount = Number(order.total_amount || 0);

  if (verifiedReference !== reference) {
    console.error("Paystack reference mismatch.", {
      expected: reference,
      received: verifiedReference,
    });

    redirect("/cart");
  }

  if (Number(verifiedAmount.toFixed(2)) !== Number(orderAmount.toFixed(2))) {
    console.error("Paystack amount mismatch.", {
      expected: orderAmount,
      received: verifiedAmount,
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

    redirect("/cart");
  }

  const processorFeeAmount = paymentData.data?.fees
    ? Number(paymentData.data.fees) / 100
    : 0;

  const result = await processPaidOrder({
    order,
    processorFeeAmount,
  });

  if (!result.processed) {
    console.error("Payment callback order processing failed:", result.reason);
    redirect("/cart");
  }

  redirect(`/order-success/${order.id}`);
}