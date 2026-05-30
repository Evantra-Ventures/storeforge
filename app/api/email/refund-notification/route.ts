import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const { orderId, refundAmount, refundStatus } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        tenant:tenants (
          name,
          slug
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (!order.customer_email) {
      return NextResponse.json(
        { error: "Customer email not found." },
        { status: 400 }
      );
    }

    const finalRefundAmount =
      refundAmount !== undefined
        ? Number(refundAmount)
        : Number(order.refunded_amount || 0);

    const finalRefundStatus =
      refundStatus || order.refund_status || "partial";

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "StoreForge <onboarding@resend.dev>",
      to: [order.customer_email],
      subject: `Refund update for Order #${order.id.slice(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px;">
          <div style="max-width: 640px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden;">
            <div style="background: #020617; color: white; padding: 28px;">
              <h1 style="margin: 0;">${order.tenant?.name || "StoreForge"}</h1>
              <p style="margin: 8px 0 0;">Refund notification</p>
            </div>

            <div style="padding: 28px;">
              <h2 style="margin-top: 0;">Your refund has been requested</h2>

              <p>
                A refund has been initiated for your order.
                Processing time may depend on your payment provider.
              </p>

              <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin: 24px 0;">
                <p><strong>Order ID:</strong> #${order.id.slice(0, 8)}</p>
                <p><strong>Refund Amount:</strong> GHS ${finalRefundAmount.toFixed(2)}</p>
                <p><strong>Refund Status:</strong> ${finalRefundStatus}</p>
              </div>

              <p style="color: #64748b;">
                Thank you for shopping with ${order.tenant?.name || "us"}.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to send refund notification." },
      { status: 500 }
    );
  }
}