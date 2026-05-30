import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const { orderId, amount, reason } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: "Tenant profile not found." },
        { status: 403 }
      );
    }

    const allowedRoles = [
      "store_owner",
      "admin",
      "platform_admin",
      "super_admin",
    ];

    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: "You do not have permission to refund orders." },
        { status: 403 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Only paid orders can be refunded." },
        { status: 400 }
      );
    }

    const totalAmount = Number(order.total_amount || 0);
    const alreadyRefunded = Number(order.refunded_amount || 0);
    const remainingRefundable = Math.max(0, totalAmount - alreadyRefunded);

    if (remainingRefundable <= 0) {
      return NextResponse.json(
        { error: "This order has already been fully refunded." },
        { status: 400 }
      );
    }

    const refundAmount = amount ? Number(amount) : remainingRefundable;

    if (
      !Number.isFinite(refundAmount) ||
      refundAmount <= 0 ||
      refundAmount > remainingRefundable
    ) {
      return NextResponse.json(
        { error: "Invalid refund amount." },
        { status: 400 }
      );
    }

    const reference = order.checkout_session_id;

    if (!reference) {
      return NextResponse.json(
        { error: "Payment reference not found for this order." },
        { status: 400 }
      );
    }

    const refundReason =
      reason || `Refund for order #${order.id.slice(0, 8)}`;

    const refundResponse = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: reference,
        amount: Math.round(refundAmount * 100),
        currency: order.currency || "GHS",
        customer_note: refundReason,
        merchant_note: refundReason,
      }),
    });

    const refundData = await refundResponse.json();

    if (!refundResponse.ok || !refundData.status) {
      return NextResponse.json(
        {
          error: refundData.message || "Paystack refund request failed.",
        },
        { status: 400 }
      );
    }

    const newRefundedAmount = alreadyRefunded + refundAmount;
    const refundStatus = newRefundedAmount >= totalAmount ? "full" : "partial";
    const paymentStatus = refundStatus === "full" ? "refunded" : "paid";

    const { error: walletDeductionError } = await supabase.rpc(
      "deduct_merchant_wallet_for_refund",
      {
        p_order_id: order.id,
        p_tenant_id: order.tenant_id,
        p_refund_amount: Number(refundAmount.toFixed(2)),
        p_reason: refundReason,
      }
    );

    if (walletDeductionError) {
      console.error("Wallet refund deduction error:", walletDeductionError);

      return NextResponse.json(
        {
          error:
            "Refund was requested from Paystack, but wallet deduction failed. Check wallet records manually.",
          details: walletDeductionError.message,
        },
        { status: 500 }
      );
    }

    let reversedPoints = 0;

    try {
      const { data, error: loyaltyReverseError } = await supabase.rpc(
        "reverse_loyalty_points_for_refund",
        {
          p_order_id: order.id,
          p_reason: "Loyalty points reversed after order refund.",
        }
      );

      if (loyaltyReverseError) {
        console.error("Loyalty points reversal error:", loyaltyReverseError);
      } else {
        reversedPoints = Number(data || 0);
        console.log("Loyalty points reversed:", reversedPoints);
      }
    } catch (loyaltyReverseError) {
      console.error("Loyalty points reversal failed:", loyaltyReverseError);
    }

    const { error: updateOrderError } = await supabase
      .from("orders")
      .update({
        refunded_amount: Number(newRefundedAmount.toFixed(2)),
        refund_status: refundStatus,
        payment_status: paymentStatus,
        status: refundStatus === "full" ? "cancelled" : order.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("tenant_id", order.tenant_id);

    if (updateOrderError) {
      return NextResponse.json(
        { error: updateOrderError.message },
        { status: 500 }
      );
    }

    if (order.customer_id) {
      try {
        await supabase.rpc("create_customer_notification", {
          p_tenant_id: order.tenant_id,
          p_user_id: order.customer_id,
          p_type: "refund_processed",
          p_title: "Refund processed",
          p_message: `A ${refundStatus} refund of ${
            order.currency || "GHS"
          } ${Number(refundAmount || 0).toFixed(2)} was processed for order #${order.id.slice(
            0,
            8
          )}.`,
          p_channel: "in_app",
          p_priority: refundStatus === "full" ? "high" : "normal",
          p_entity_type: "order",
          p_entity_id: order.id,
          p_order_id: order.id,
          p_action_url: `/order-success/${order.id}`,
          p_metadata: {
            idempotency_key: `refund_processed:${order.id}:${Number(
              newRefundedAmount
            ).toFixed(2)}`,
            order_id: order.id,
            refund_amount: Number(refundAmount.toFixed(2)),
            new_refunded_amount: Number(newRefundedAmount.toFixed(2)),
            refund_status: refundStatus,
            payment_status: paymentStatus,
          },
        });

        if (reversedPoints > 0) {
          await supabase.rpc("create_customer_notification", {
            p_tenant_id: order.tenant_id,
            p_user_id: order.customer_id,
            p_type: "loyalty_points_reversed",
            p_title: "Loyalty points reversed",
            p_message: `${reversedPoints.toLocaleString()} loyalty points were reversed because order #${order.id.slice(
              0,
              8
            )} was refunded.`,
            p_channel: "in_app",
            p_priority: "normal",
            p_entity_type: "order",
            p_entity_id: order.id,
            p_order_id: order.id,
            p_action_url: "/customer/loyalty",
            p_metadata: {
              idempotency_key: `loyalty_points_reversed:${order.id}`,
              order_id: order.id,
              reversed_points: reversedPoints,
            },
          });
        }
      } catch (notificationError) {
        console.error("Refund notification error:", notificationError);
      }
    }

    try {
      await supabase.from("audit_logs").insert({
        tenant_id: order.tenant_id,
        actor_id: user.id,
        action: "order_refund",
        entity_type: "order",
        entity_id: order.id,
        severity: refundStatus === "full" ? "warning" : "info",
        description: `Refund processed for order #${order.id.slice(0, 8)}.`,
        metadata: {
          order_id: order.id,
          refund_amount: Number(refundAmount.toFixed(2)),
          currency: order.currency || "GHS",
          total_amount: totalAmount,
          already_refunded: alreadyRefunded,
          new_refunded_amount: Number(newRefundedAmount.toFixed(2)),
          refund_status: refundStatus,
          payment_status: paymentStatus,
          paystack_refund: refundData.data || null,
          reversed_loyalty_points: reversedPoints,
          reason: refundReason,
        },
      });
    } catch (auditError) {
      console.error("Refund audit log error:", auditError);
    }

    return NextResponse.json({
      success: true,
      message:
        reversedPoints > 0
          ? "Refund requested, wallet deducted, loyalty points reversed, and customer notified successfully."
          : "Refund requested, wallet deducted, and customer notified successfully.",
      refund: refundData.data,
      loyalty: {
        reversedPoints,
      },
      order: {
        id: order.id,
        refundedAmount: Number(newRefundedAmount.toFixed(2)),
        refundStatus,
        paymentStatus,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Refund request failed." },
      { status: 500 }
    );
  }
}
