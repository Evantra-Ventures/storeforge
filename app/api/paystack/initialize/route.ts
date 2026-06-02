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

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Payment provider is not configured." },
        { status: 500 }
      );
    }

    const { orderId } = await request.json();

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

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", order.tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
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

    if (!["pending", "awaiting_payment"].includes(order.status)) {
      return NextResponse.json(
        { error: "This order is not eligible for payment." },
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

    const amountInSubunit = Math.round(totalAmount * 100);

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const reference =
      order.checkout_session_id ||
      `sf_${order.id.replaceAll("-", "")}_${Date.now()}`;

    const { error: updateReferenceError } = await supabase
      .from("orders")
      .update({
        checkout_session_id: reference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("customer_id", user.id);

    if (updateReferenceError) {
      return NextResponse.json(
        { error: "Failed to prepare payment session." },
        { status: 400 }
      );
    }

    const callbackUrl = `${baseUrl}/payment/callback?reference=${encodeURIComponent(
      reference
    )}&orderId=${encodeURIComponent(order.id)}`;

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: order.customer_email || user.email,
          amount: amountInSubunit,
          currency: order.currency || tenant.currency || "GHS",
          reference,
          callback_url: callbackUrl,
          metadata: {
            order_id: order.id,
            tenant_id: order.tenant_id,
            store_slug: tenant.slug,
            customer_id: user.id,
            subtotal_amount: order.subtotal_amount,
            discount_amount: order.discount_amount,
            shipping_fee: order.shipping_fee,
            total_amount: order.total_amount,
            delivery_method: order.delivery_method,
            coupon_id: order.coupon_id,
            coupon_code: order.coupon_code,
          },
        }),
      }
    );

    const paystackData = await response.json();

    if (!response.ok || !paystackData.status) {
      return NextResponse.json(
        {
          error: paystackData.message || "Failed to initialize payment.",
        },
        { status: 400 }
      );
    }

    const paystackReference = paystackData.data?.reference || reference;

    if (paystackReference !== reference) {
      await supabase
        .from("orders")
        .update({
          checkout_session_id: paystackReference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("customer_id", user.id);
    }

    return NextResponse.json({
      authorizationUrl: paystackData.data.authorization_url,
      reference: paystackReference,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Payment initialization failed." },
      { status: 500 }
    );
  }
}