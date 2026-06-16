import { createClient } from "@/lib/supabase/server";

type ProcessPaidOrderResult = {
  processed: boolean;
  alreadyPaid: boolean;
  walletCredited: boolean;
  settlementRecorded?: boolean;
  reason?: string;
};

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "GHS").trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return "GHS";
  }

  return normalized;
}

function roundMoney(value: number) {
  return Number(Number(value || 0).toFixed(2));
}

function cleanText(value?: string | null) {
  return (value || "").trim();
}

async function getPlatformFeeFallback({
  supabase,
  tenantId,
  grossAmount,
}: {
  supabase: ReturnType<typeof createClient>;
  tenantId: string;
  grossAmount: number;
}) {
  const { data: tenantFeeSetting } = await supabase
    .from("platform_fee_settings")
    .select("fee_type, fee_value")
    .eq("tenant_id", tenantId)
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
      : grossAmount * (Number(feeSetting?.fee_value || 5) / 100);

  return roundMoney(platformFeeAmount);
}

export async function processPaidOrder({
  order,
  processorFeeAmount = 0,
  paystackReference,
  paystackTransactionId,
  paystackMetadata = {},
}: {
  order: any;
  processorFeeAmount?: number;
  paystackReference?: string | null;
  paystackTransactionId?: string | null;
  paystackMetadata?: Record<string, any>;
}): Promise<ProcessPaidOrderResult> {
  const supabase = createClient();

  if (!order) {
    return {
      processed: false,
      alreadyPaid: false,
      walletCredited: false,
      settlementRecorded: false,
      reason: "Order not found.",
    };
  }

  if (order.payment_status === "paid") {
    return {
      processed: true,
      alreadyPaid: true,
      walletCredited: false,
      settlementRecorded: false,
    };
  }

  const orderId = order.id;
  const tenantId = order.tenant_id;
  const customerId = order.customer_id;

  const grossAmount = roundMoney(Number(order.total_amount || 0));
  const currency = normalizeCurrency(order.currency);

  const resolvedReference =
    cleanText(paystackReference) ||
    cleanText(order.paystack_transaction_reference) ||
    cleanText(order.checkout_session_id) ||
    null;

  const resolvedTransactionId =
    cleanText(paystackTransactionId) ||
    cleanText(order.paystack_transaction_id) ||
    null;

  if (!orderId || !tenantId) {
    return {
      processed: false,
      alreadyPaid: false,
      walletCredited: false,
      settlementRecorded: false,
      reason: "Invalid order.",
    };
  }

  if (!grossAmount || grossAmount <= 0) {
    return {
      processed: false,
      alreadyPaid: false,
      walletCredited: false,
      settlementRecorded: false,
      reason: "Invalid order amount.",
    };
  }

  const { data: orderItems, error: orderItemsError } = await supabase
    .from("order_items")
    .select("id, quantity, product_id, variant_id")
    .eq("order_id", orderId);

  if (orderItemsError) {
    console.error("Order items fetch error:", orderItemsError);

    return {
      processed: false,
      alreadyPaid: false,
      walletCredited: false,
      settlementRecorded: false,
      reason: "Failed to fetch order items.",
    };
  }

  if (!orderItems || orderItems.length === 0) {
    return {
      processed: false,
      alreadyPaid: false,
      walletCredited: false,
      settlementRecorded: false,
      reason: "Order has no items.",
    };
  }

  for (const item of orderItems as any[]) {
    const quantity = Number(item.quantity || 0);

    if (!quantity || quantity <= 0) continue;

    if (item.variant_id) {
      const { data: success, error } = await supabase.rpc(
        "decrement_product_variant_inventory",
        {
          p_variant_id: item.variant_id,
          p_quantity: quantity,
        }
      );

      if (error || !success) {
        console.error("Variant inventory deduction error:", error);

        await supabase
          .from("orders")
          .update({
            status: "cancelled",
            payment_status: "paid",
            settlement_status: "manual_review",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        return {
          processed: false,
          alreadyPaid: false,
          walletCredited: false,
          settlementRecorded: false,
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
        p_quantity: quantity,
      }
    );

    if (error || !success) {
      console.error("Product inventory deduction error:", error);

      await supabase
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "paid",
          settlement_status: "manual_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      return {
        processed: false,
        alreadyPaid: false,
        walletCredited: false,
        settlementRecorded: false,
        reason: "Insufficient product inventory.",
      };
    }
  }

  const { data: splitRecord, error: splitFetchError } = await supabase
    .from("payment_splits")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (splitFetchError) {
    console.error("Payment split fetch error:", splitFetchError);
  }

  const hasPaystackSplit =
    Boolean(order.paystack_split_applied) ||
    Boolean(order.paystack_subaccount_code) ||
    Boolean(splitRecord?.paystack_subaccount_code);

  const platformFeeAmount = roundMoney(
    Number(
      splitRecord?.platform_fee_amount ||
        order.platform_fee_amount ||
        (await getPlatformFeeFallback({
          supabase,
          tenantId,
          grossAmount,
        }))
    )
  );

  const merchantGrossAmount = roundMoney(
    Number(
      splitRecord?.merchant_gross_amount ||
        order.merchant_gross_amount ||
        Math.max(0, grossAmount - platformFeeAmount)
    )
  );

  const merchantNetEstimate = roundMoney(
    Number(
      splitRecord?.merchant_net_estimate ||
        order.merchant_net_estimate ||
        merchantGrossAmount
    )
  );

  const paymentFeeBearer =
    splitRecord?.payment_fee_bearer ||
    order.payment_fee_bearer ||
    "merchant";

  let settlementRecorded = false;
  let walletCredited = false;

  if (hasPaystackSplit) {
    const splitPayload = {
      tenant_id: tenantId,
      order_id: orderId,
      customer_id: customerId || null,
      currency,
      order_total: grossAmount,
      platform_commission_percentage: roundMoney(
        Number(
          splitRecord?.platform_commission_percentage ||
            order.platform_commission_percentage ||
            5
        )
      ),
      platform_fee_amount: platformFeeAmount,
      merchant_gross_amount: merchantGrossAmount,
      merchant_net_estimate: merchantNetEstimate,
      payment_fee_bearer: paymentFeeBearer,
      paystack_subaccount_code:
        splitRecord?.paystack_subaccount_code ||
        order.paystack_subaccount_code ||
        null,
      paystack_transaction_reference: resolvedReference,
      paystack_transaction_id: resolvedTransactionId,
      status: "paid",
      metadata: {
        ...(splitRecord?.metadata || {}),
        ...paystackMetadata,
        source: "processPaidOrder",
        processed_at: new Date().toISOString(),
        processor_fee_amount: roundMoney(processorFeeAmount),
      },
    };

    const { error: splitUpsertError } = await supabase
      .from("payment_splits")
      .upsert(splitPayload, {
        onConflict: "order_id",
      });

    if (splitUpsertError) {
      console.error("Payment split record error:", splitUpsertError);
    } else {
      settlementRecorded = true;
    }

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "processing",
        settlement_status: settlementRecorded ? "processing" : "manual_review",
        platform_fee_amount: platformFeeAmount,
        merchant_gross_amount: merchantGrossAmount,
        merchant_net_estimate: merchantNetEstimate,
        payment_fee_bearer: paymentFeeBearer,
        paystack_transaction_reference: resolvedReference,
        paystack_transaction_id: resolvedTransactionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (orderUpdateError) {
      console.error("Order paid update error:", orderUpdateError);

      return {
        processed: false,
        alreadyPaid: false,
        walletCredited: false,
        settlementRecorded,
        reason: "Failed to update paid order.",
      };
    }
  } else {
    const platformFeeForWallet = platformFeeAmount;

    const { data: walletCreditResult, error: walletCreditError } =
      await supabase.rpc("credit_merchant_wallet_for_order", {
        p_order_id: orderId,
        p_tenant_id: tenantId,
        p_gross_amount: grossAmount,
        p_currency: currency,
        p_platform_fee_amount: platformFeeForWallet,
        p_processor_fee_amount: roundMoney(processorFeeAmount),
      });

    if (walletCreditError) {
      console.error("Wallet credit error:", walletCreditError);

      return {
        processed: false,
        alreadyPaid: false,
        walletCredited: false,
        settlementRecorded: false,
        reason: "Wallet credit failed.",
      };
    }

    walletCredited = !!walletCreditResult;

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        status: "processing",
        settlement_status: "manual_review",
        platform_fee_amount: platformFeeForWallet,
        merchant_gross_amount: roundMoney(
          Math.max(0, grossAmount - platformFeeForWallet)
        ),
        merchant_net_estimate: roundMoney(
          Math.max(0, grossAmount - platformFeeForWallet - processorFeeAmount)
        ),
        paystack_transaction_reference: resolvedReference,
        paystack_transaction_id: resolvedTransactionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (orderUpdateError) {
      console.error("Order paid update error:", orderUpdateError);

      return {
        processed: false,
        alreadyPaid: false,
        walletCredited,
        settlementRecorded: false,
        reason: "Failed to update paid order.",
      };
    }
  }

  if (customerId) {
    await supabase.rpc("update_customer_profile_order_stats", {
      p_tenant_id: tenantId,
      p_user_id: customerId,
      p_order_total: grossAmount,
      p_order_created_at: order.created_at || new Date().toISOString(),
    });

    try {
      await supabase.rpc("create_customer_notification", {
        p_tenant_id: tenantId,
        p_user_id: customerId,
        p_type: "payment_confirmed",
        p_title: "Payment confirmed",
        p_message: `Your payment for order #${orderId.slice(
          0,
          8
        )} was confirmed.`,
        p_channel: "in_app",
        p_priority: "normal",
        p_entity_type: "order",
        p_entity_id: orderId,
        p_order_id: orderId,
        p_action_url: `/order-success/${orderId}`,
        p_metadata: {
          idempotency_key: `payment_confirmed:${orderId}`,
          order_id: orderId,
          amount: grossAmount,
          currency,
          settlement_model: hasPaystackSplit ? "paystack_split" : "wallet",
        },
      });

      await supabase.rpc("create_customer_notification", {
        p_tenant_id: tenantId,
        p_user_id: customerId,
        p_type: "order_processing",
        p_title: "Order is processing",
        p_message: `Your order #${orderId.slice(
          0,
          8
        )} is now being processed.`,
        p_channel: "in_app",
        p_priority: "normal",
        p_entity_type: "order",
        p_entity_id: orderId,
        p_order_id: orderId,
        p_action_url: `/order-success/${orderId}`,
        p_metadata: {
          idempotency_key: `order_processing:${orderId}`,
          order_id: orderId,
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
        p_order_id: orderId,
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

  if (customerId && pointsAwarded > 0) {
    try {
      await supabase.rpc("create_customer_notification", {
        p_tenant_id: tenantId,
        p_user_id: customerId,
        p_type: "loyalty_points_earned",
        p_title: "You earned loyalty points",
        p_message: `You earned ${pointsAwarded.toLocaleString()} points from order #${orderId.slice(
          0,
          8
        )}.`,
        p_channel: "in_app",
        p_priority: "normal",
        p_entity_type: "order",
        p_entity_id: orderId,
        p_order_id: orderId,
        p_action_url: "/customer/loyalty",
        p_metadata: {
          idempotency_key: `loyalty_points_earned:${orderId}`,
          order_id: orderId,
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
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (coupon) {
      await supabase
        .from("coupons")
        .update({
          used_count: Number(coupon.used_count || 0) + 1,
        })
        .eq("id", order.coupon_id)
        .eq("tenant_id", tenantId);
    }
  }

  if (customerId) {
    const { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", customerId)
      .eq("tenant_id", tenantId)
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
      body: JSON.stringify({ orderId }),
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
      body: JSON.stringify({ tenantId }),
    });
  } catch (emailError) {
    console.error("Low-stock alert email trigger failed:", emailError);
  }

  return {
    processed: true,
    alreadyPaid: false,
    walletCredited,
    settlementRecorded,
  };
}