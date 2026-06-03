import { createClient } from "@/lib/supabase/server";

type ProcessPaidOrderResult = {
  processed: boolean;
  alreadyPaid: boolean;
  walletCredited: boolean;
  reason?: string;
};

export async function processPaidOrder({
  order,
  processorFeeAmount = 0,
}: {
  order: any;
  processorFeeAmount?: number;
}): Promise<ProcessPaidOrderResult> {
  const supabase = createClient();

  if (!order) {
    return {
      processed: false,
      alreadyPaid: false,
      walletCredited: false,
      reason: "Order not found.",
    };
  }

  if (order.payment_status === "paid") {
    return {
      processed: true,
      alreadyPaid: true,
      walletCredited: false,
    };
  }

  const { data: orderItems, error: orderItemsError } = await supabase
    .from("order_items")
    .select("id, quantity, product_id, variant_id")
    .eq("order_id", order.id);

  if (orderItemsError) {
    console.error("Order items fetch error:", orderItemsError);

    return {
      processed: false,
      alreadyPaid: false,
      walletCredited: false,
      reason: "Failed to fetch order items.",
    };
  }

  if (!orderItems || orderItems.length === 0) {
    return {
      processed: false,
      alreadyPaid: false,
      walletCredited: false,
      reason: "Order has no items.",
    };
  }

  for (const item of orderItems as any[]) {
    if (item.variant_id) {
      const { data: success, error } = await supabase.rpc(
        "decrement_product_variant_inventory",
        {
          p_variant_id: item.variant_id,
          p_quantity: item.quantity,
        }
      );

      if (error || !success) {
        console.error("Variant inventory deduction error:", error);

        await supabase
          .from("orders")
          .update({
            status: "cancelled",
            payment_status: "paid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        return {
          processed: false,
          alreadyPaid: false,
          walletCredited: false,
          reason: "Insufficient variant inventory.",
        };
      }

      continue;
    }

    if (!item.product_id) continue;

    const { data: success, error } = await supabase.rpc(
      "decrement_product_inventory",
      {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      }
    );

    if (error || !success) {
      console.error("Product inventory deduction error:", error);

      await supabase
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      return {
        processed: false,
        alreadyPaid: false,
        walletCredited: false,
        reason: "Insufficient product inventory.",
      };
    }
  }

  const grossAmount = Number(order.total_amount || 0);
  const currency = order.currency || "GHS";

  const { data: tenantFeeSetting } = await supabase
    .from("platform_fee_settings")
    .select("fee_type, fee_value")
    .eq("tenant_id", order.tenant_id)
    .eq("status", "active")
    .maybeSingle();

  let feeSetting = tenantFeeSetting;

  if (!feeSetting) {
    const { data: defaultFeeSetting } = await supabase
      .from("platform_fee_settings")
      .select("fee_type, fee_value")
      .eq("is_default", true)
      .eq("status", "active")
      .maybeSingle();

    feeSetting = defaultFeeSetting;
  }

  const platformFeeAmount =
    feeSetting?.fee_type === "fixed"
      ? Number(feeSetting.fee_value || 0)
      : grossAmount * (Number(feeSetting?.fee_value || 0) / 100);

  const { data: walletCredited, error: walletCreditError } =
    await supabase.rpc("credit_merchant_wallet_for_order", {
      p_order_id: order.id,
      p_tenant_id: order.tenant_id,
      p_gross_amount: grossAmount,
      p_currency: currency,
      p_platform_fee_amount: Number(platformFeeAmount.toFixed(2)),
      p_processor_fee_amount: Number(processorFeeAmount.toFixed(2)),
    });

  if (walletCreditError) {
    console.error("Wallet credit error:", walletCreditError);

    return {
      processed: false,
      alreadyPaid: false,
      walletCredited: false,
      reason: "Wallet credit failed.",
    };
  }

  await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (order.customer_id) {
    await supabase.rpc("update_customer_profile_order_stats", {
      p_tenant_id: order.tenant_id,
      p_user_id: order.customer_id,
      p_order_total: grossAmount,
      p_order_created_at: order.created_at || new Date().toISOString(),
    });

    try {
      await supabase.rpc("create_customer_notification", {
        p_tenant_id: order.tenant_id,
        p_user_id: order.customer_id,
        p_type: "payment_confirmed",
        p_title: "Payment confirmed",
        p_message: `Your payment for order #${order.id.slice(
          0,
          8
        )} was confirmed.`,
        p_channel: "in_app",
        p_priority: "normal",
        p_entity_type: "order",
        p_entity_id: order.id,
        p_order_id: order.id,
        p_action_url: `/order-success/${order.id}`,
        p_metadata: {
          idempotency_key: `payment_confirmed:${order.id}`,
          order_id: order.id,
          amount: grossAmount,
          currency,
        },
      });

      await supabase.rpc("create_customer_notification", {
        p_tenant_id: order.tenant_id,
        p_user_id: order.customer_id,
        p_type: "order_processing",
        p_title: "Order is processing",
        p_message: `Your order #${order.id.slice(
          0,
          8
        )} is now being processed.`,
        p_channel: "in_app",
        p_priority: "normal",
        p_entity_type: "order",
        p_entity_id: order.id,
        p_order_id: order.id,
        p_action_url: `/order-success/${order.id}`,
        p_metadata: {
          idempotency_key: `order_processing:${order.id}`,
          order_id: order.id,
        },
      });
    } catch (notificationError) {
      console.error("Payment notification error:", notificationError);
    }
  }

  let pointsAwarded = 0;

  try {
    const { data, error: loyaltyError } = await supabase.rpc(
      "award_loyalty_points_for_order",
      {
        p_order_id: order.id,
      }
    );

    if (loyaltyError) {
      console.error("Loyalty points award error:", loyaltyError);
    } else {
      pointsAwarded = Number(data || 0);
    }
  } catch (loyaltyError) {
    console.error("Loyalty points award failed:", loyaltyError);
  }

  if (order.customer_id && pointsAwarded > 0) {
    try {
      await supabase.rpc("create_customer_notification", {
        p_tenant_id: order.tenant_id,
        p_user_id: order.customer_id,
        p_type: "loyalty_points_earned",
        p_title: "You earned loyalty points",
        p_message: `You earned ${pointsAwarded.toLocaleString()} points from order #${order.id.slice(
          0,
          8
        )}.`,
        p_channel: "in_app",
        p_priority: "normal",
        p_entity_type: "order",
        p_entity_id: order.id,
        p_order_id: order.id,
        p_action_url: "/customer/loyalty",
        p_metadata: {
          idempotency_key: `loyalty_points_earned:${order.id}`,
          order_id: order.id,
          points_awarded: pointsAwarded,
        },
      });
    } catch (notificationError) {
      console.error("Loyalty notification error:", notificationError);
    }
  }

  if (order.coupon_id) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("used_count")
      .eq("id", order.coupon_id)
      .eq("tenant_id", order.tenant_id)
      .maybeSingle();

    if (coupon) {
      await supabase
        .from("coupons")
        .update({
          used_count: Number(coupon.used_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.coupon_id)
        .eq("tenant_id", order.tenant_id);
    }
  }

  if (order.customer_id) {
    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", order.customer_id)
      .eq("tenant_id", order.tenant_id)
      .eq("status", "active")
      .maybeSingle();

    if (cart) {
      await supabase.from("cart_items").delete().eq("cart_id", cart.id);
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    await fetch(`${siteUrl}/api/email/order-receipt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId: order.id }),
    });
  } catch (emailError) {
    console.error("Order receipt email trigger failed:", emailError);
  }

  try {
    await fetch(`${siteUrl}/api/email/low-stock-alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tenantId: order.tenant_id }),
    });
  } catch (emailError) {
    console.error("Low-stock alert email trigger failed:", emailError);
  }

  return {
    processed: true,
    alreadyPaid: false,
    walletCredited: !!walletCredited,
  };
}