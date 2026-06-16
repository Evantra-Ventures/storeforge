import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getStoreVisibilityStatus(tenant: any) {
  if (tenant?.store_status) return tenant.store_status;
  if (tenant?.status) return tenant.status;
  if (tenant?.is_published === false) return "draft";
  return "active";
}

function isStorePublic(status: string) {
  return status === "active" || status === "published";
}

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "").trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return "";
  }

  return normalized;
}

function cleanText(value?: string | null) {
  return (value || "").trim();
}

function getPaystackErrorMessage(data: any) {
  if (!data) return "Failed to initialize payment.";
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  return "Failed to initialize payment.";
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Payment provider is not configured." },
        { status: 500 }
      );
    }

    let body: { orderId?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid payment request body." },
        { status: 400 }
      );
    }

    const orderId = body.orderId;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json(
        { error: orderError.message || "Failed to load order." },
        { status: 400 }
      );
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select(`
        id,
        name,
        slug,
        status,
        store_status,
        is_published,
        currency,
        paystack_subaccount_code,
        payout_setup_status,
        payment_fee_bearer,
        platform_commission_percentage
      `)
      .eq("id", order.tenant_id)
      .maybeSingle();

    if (tenantError) {
      return NextResponse.json(
        { error: tenantError.message || "Failed to load store." },
        { status: 400 }
      );
    }

    if (!tenant) {
      return NextResponse.json({ error: "Store not found." }, { status: 404 });
    }

    const storeStatus = getStoreVisibilityStatus(tenant);

    if (!isStorePublic(storeStatus)) {
      return NextResponse.json(
        { error: "This store is not accepting payments right now." },
        { status: 403 }
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { error: "Order has already been paid." },
        { status: 400 }
      );
    }

    if (order.status === "cancelled") {
      return NextResponse.json(
        { error: "Cancelled orders cannot be paid." },
        { status: 400 }
      );
    }

    const allowedOrderStatuses = ["pending", "awaiting_payment"];

    if (!allowedOrderStatuses.includes(order.status || "pending")) {
      return NextResponse.json(
        {
          error: `This order is not eligible for payment. Current status: ${
            order.status || "unknown"
          }.`,
        },
        { status: 400 }
      );
    }

    const totalAmount = Number(order.total_amount || 0);

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid order amount." },
        { status: 400 }
      );
    }

    const orderCurrency = normalizeCurrency(order.currency);

    if (!orderCurrency) {
      return NextResponse.json(
        {
          error:
            "Order currency is missing or invalid. Please recreate the order from checkout.",
        },
        { status: 400 }
      );
    }

    const customerEmail = order.customer_email || user.email;

    if (!customerEmail) {
      return NextResponse.json(
        { error: "Customer email is required for payment." },
        { status: 400 }
      );
    }

    const subaccountCode = cleanText(tenant.paystack_subaccount_code);

    if (!subaccountCode || tenant.payout_setup_status !== "active") {
      return NextResponse.json(
        {
          error:
            "This store has not completed Paystack settlement setup. The merchant must activate settlement before accepting online payments.",
        },
        { status: 400 }
      );
    }

    const { data: split, error: splitError } = await supabase.rpc(
      "snapshot_order_payment_split",
      {
        p_order_id: order.id,
      }
    );

    if (splitError || !split) {
      return NextResponse.json(
        {
          error:
            splitError?.message ||
            "Failed to prepare payment split for this order.",
        },
        { status: 400 }
      );
    }

    const splitCurrency = normalizeCurrency(split.currency || orderCurrency);

    if (!splitCurrency) {
      return NextResponse.json(
        {
          error:
            "Payment split currency is missing or invalid. Please recreate the order from checkout.",
        },
        { status: 400 }
      );
    }

    const splitSubaccountCode = cleanText(
      split.paystack_subaccount_code || subaccountCode
    );

    if (!splitSubaccountCode) {
      return NextResponse.json(
        {
          error:
            "Paystack subaccount is missing from this payment split. Please activate settlement setup again.",
        },
        { status: 400 }
      );
    }

    const platformFeeAmount = Number(split.platform_fee_amount || 0);
    const platformFeeInSubunit = Math.round(platformFeeAmount * 100);
    const amountInSubunit = Math.round(totalAmount * 100);

    if (
      !Number.isFinite(platformFeeInSubunit) ||
      platformFeeInSubunit < 0 ||
      platformFeeInSubunit >= amountInSubunit
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid platform fee for this order. Please check your settlement settings.",
        },
        { status: 400 }
      );
    }

    const feeBearer =
      split.payment_fee_bearer === "platform" ? "account" : "subaccount";

    const requestUrl = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin;

    const reference =
      order.checkout_session_id ||
      `sf_${order.id.replaceAll("-", "")}_${Date.now()}`;

    const { error: updateReferenceError } = await supabase
      .from("orders")
      .update({
        checkout_session_id: reference,
        paystack_transaction_reference: reference,
      })
      .eq("id", order.id)
      .eq("customer_id", user.id);

    if (updateReferenceError) {
      return NextResponse.json(
        {
          error:
            updateReferenceError.message ||
            "Failed to prepare payment session.",
        },
        { status: 400 }
      );
    }

    const callbackUrl = `${baseUrl}/payment/callback?reference=${encodeURIComponent(
      reference
    )}&orderId=${encodeURIComponent(order.id)}`;

    const paystackPayload: Record<string, any> = {
      email: customerEmail,
      amount: amountInSubunit,
      currency: splitCurrency,
      reference,
      callback_url: callbackUrl,

      subaccount: splitSubaccountCode,
      transaction_charge: platformFeeInSubunit,
      bearer: feeBearer,

      metadata: {
        order_id: order.id,
        tenant_id: order.tenant_id,
        store_slug: tenant.slug,
        customer_id: user.id,

        currency: splitCurrency,

        subtotal_amount: order.subtotal_amount,
        discount_amount: order.discount_amount,
        shipping_fee: order.shipping_fee,
        total_amount: order.total_amount,

        platform_commission_percentage:
          split.platform_commission_percentage,
        platform_fee_amount: split.platform_fee_amount,
        merchant_gross_amount: split.merchant_gross_amount,
        merchant_net_estimate: split.merchant_net_estimate,
        payment_fee_bearer: split.payment_fee_bearer,

        paystack_subaccount_code: splitSubaccountCode,
        paystack_fee_bearer: feeBearer,

        delivery_method: order.delivery_method,
        coupon_id: order.coupon_id,
        coupon_code: order.coupon_code,

        platform: "StoreForge",
        payment_model: "paystack_split",
      },
    };

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paystackPayload),
      }
    );

    const paystackData = await response.json();

    if (!response.ok || !paystackData.status) {
      return NextResponse.json(
        {
          error: getPaystackErrorMessage(paystackData),
          paystack_status: response.status,
          currency: splitCurrency,
          split_applied: true,
          subaccount: splitSubaccountCode,
        },
        { status: 400 }
      );
    }

    const paystackReference = paystackData.data?.reference || reference;
    const paystackTransactionId =
      paystackData.data?.id?.toString?.() || null;

    if (paystackReference !== reference || paystackTransactionId) {
      const { error: finalReferenceError } = await supabase
        .from("orders")
        .update({
          checkout_session_id: paystackReference,
          paystack_transaction_reference: paystackReference,
          paystack_transaction_id: paystackTransactionId,
        })
        .eq("id", order.id)
        .eq("customer_id", user.id);

      if (finalReferenceError) {
        return NextResponse.json(
          {
            error:
              finalReferenceError.message ||
              "Payment was initialized, but order reference could not be saved.",
          },
          { status: 400 }
        );
      }
    }

    await supabase
      .from("payment_splits")
      .update({
        paystack_transaction_reference: paystackReference,
        paystack_transaction_id: paystackTransactionId,
        status: "initialized",
      })
      .eq("order_id", order.id);

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      reference: paystackReference,
      currency: splitCurrency,
      splitApplied: true,
      subaccount: splitSubaccountCode,
      platformFeeAmount: split.platform_fee_amount,
      paymentFeeBearer: split.payment_fee_bearer,
    });
  } catch (error) {
    console.error("Payment initialization failed:", error);

    return NextResponse.json(
      { error: "Payment initialization failed." },
      { status: 500 }
    );
  }
}