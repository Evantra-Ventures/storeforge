import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured." },
        { status: 500 }
      );
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      return NextResponse.json(
        { error: "RESEND_FROM_EMAIL is not configured." },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const supabase = createClient();

    const { orderId } = await request.json();

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

    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`
        quantity,
        price,
        variant_id,
        product:products (
          name
        ),
        variant:product_variants (
          name,
          option_name,
          option_value,
          sku
        )
      `)
      .eq("order_id", order.id);

    const { data: loyaltyRedemption } = await supabase
      .from("loyalty_reward_redemptions")
      .select(`
        id,
        points_redeemed,
        discount_amount,
        free_shipping_applied,
        code,
        status,
        reward:loyalty_rewards (
          name,
          reward_type
        )
      `)
      .eq("order_id", order.id)
      .maybeSingle();

    const { data: earnedTransaction } = await supabase
      .from("loyalty_transactions")
      .select("points,status")
      .eq("order_id", order.id)
      .eq("type", "earned")
      .in("status", ["completed", "reversed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const itemsHtml = (orderItems || [])
      .map((item: any) => {
        const product = Array.isArray(item.product)
          ? item.product[0]
          : item.product;

        const variant = Array.isArray(item.variant)
          ? item.variant[0]
          : item.variant;

        const itemName = product?.name || "Product";

        const variantHtml = variant
          ? `
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
              ${variant.option_name || "Option"}: ${
                variant.option_value || variant.name || "Variant"
              }
              ${
                variant.sku
                  ? `<br/><span style="color: #94a3b8;">SKU: ${variant.sku}</span>`
                  : ""
              }
            </div>
          `
          : "";

        const unitPrice = Number(item.price || 0);
        const lineTotal = unitPrice * Number(item.quantity || 0);

        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <strong>${itemName}</strong>
              ${variantHtml}
            </td>

            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
              ${item.quantity}
            </td>

            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
              <div>GHS ${unitPrice.toFixed(2)}</div>
              <div style="font-size: 12px; color: #64748b;">
                Total: GHS ${lineTotal.toFixed(2)}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    const subtotalAmount = Number(order.subtotal_amount || 0);
    const discountAmount = Number(order.discount_amount || 0);
    const shippingFee = Number(order.shipping_fee || 0);
    const totalAmount = Number(order.total_amount || 0);

    const loyaltyPointsRedeemed = Number(
      loyaltyRedemption?.points_redeemed || 0
    );

    const loyaltyDiscountAmount = Number(
      loyaltyRedemption?.discount_amount || 0
    );

    const couponDiscountAmount =
      order.coupon_code && discountAmount > loyaltyDiscountAmount
        ? discountAmount - loyaltyDiscountAmount
        : 0;

    const loyaltyPointsEarned =
      earnedTransaction?.status === "reversed"
        ? 0
        : Number(earnedTransaction?.points || 0);

    const deliveryLocation = [
      order.shipping_area,
      order.shipping_city,
      order.shipping_region,
    ]
      .filter(Boolean)
      .join(", ");

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "StoreForge <onboarding@resend.dev>",
      to: [order.customer_email],
      subject: `Receipt for Order #${order.id.slice(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px;">
          <div style="max-width: 720px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden;">

            <div style="background: #020617; color: white; padding: 28px;">
              <h1 style="margin: 0;">
                ${order.tenant?.name || "StoreForge"}
              </h1>

              <p style="margin: 8px 0 0;">
                Order receipt
              </p>
            </div>

            <div style="padding: 28px;">
              <h2 style="margin-top: 0;">
                Thank you for your order!
              </h2>

              <p>
                Your order has been received and is being processed.
              </p>

              <div
                style="
                  background: #f1f5f9;
                  border-radius: 12px;
                  padding: 16px;
                  margin: 24px 0;
                "
              >
                <p>
                  <strong>Order ID:</strong>
                  #${order.id.slice(0, 8)}
                </p>

                <p>
                  <strong>Status:</strong>
                  ${order.status}
                </p>

                <p>
                  <strong>Payment:</strong>
                  ${order.payment_status}
                </p>
              </div>

              <div
                style="
                  background: #f8fafc;
                  border: 1px solid #e2e8f0;
                  border-radius: 12px;
                  padding: 20px;
                  margin-bottom: 24px;
                "
              >
                <h3 style="margin-top: 0;">
                  Delivery Details
                </h3>

                <p>
                  <strong>Delivery Method:</strong>
                  ${order.delivery_method || "delivery"}
                </p>

                <p>
                  <strong>Recipient:</strong>
                  ${
                    order.shipping_full_name ||
                    order.customer_name ||
                    "Customer"
                  }
                </p>

                <p>
                  <strong>Phone:</strong>
                  ${order.shipping_phone || "Not provided"}
                </p>

                ${
                  order.delivery_method === "delivery"
                    ? `
                      <p>
                        <strong>Delivery Area:</strong>
                        ${deliveryLocation || "Not provided"}
                      </p>

                      <p>
                        <strong>Address:</strong>
                        ${order.shipping_address || "Not provided"}
                      </p>
                    `
                    : `
                      <p>
                        <strong>Pickup Order</strong>
                      </p>
                    `
                }

                ${
                  order.shipping_note
                    ? `
                      <p>
                        <strong>Note:</strong>
                        ${order.shipping_note}
                      </p>
                    `
                    : ""
                }
              </div>

              <table
                style="
                  width: 100%;
                  border-collapse: collapse;
                "
              >
                <thead>
                  <tr>
                    <th style="text-align: left; padding: 12px;">
                      Item
                    </th>

                    <th style="text-align: center; padding: 12px;">
                      Qty
                    </th>

                    <th style="text-align: right; padding: 12px;">
                      Price
                    </th>
                  </tr>
                </thead>

                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div style="margin-top: 32px;">
                <div
                  style="
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 12px;
                  "
                >
                  <span style="color: #64748b;">
                    Subtotal
                  </span>

                  <span>
                    GHS ${subtotalAmount.toFixed(2)}
                  </span>
                </div>

                ${
                  couponDiscountAmount > 0
                    ? `
                      <div
                        style="
                          display: flex;
                          justify-content: space-between;
                          margin-bottom: 12px;
                          color: #15803d;
                        "
                      >
                        <span>
                          Coupon Discount (${order.coupon_code})
                        </span>

                        <span>
                          - GHS ${couponDiscountAmount.toFixed(2)}
                        </span>
                      </div>
                    `
                    : ""
                }

                ${
                  loyaltyDiscountAmount > 0
                    ? `
                      <div
                        style="
                          display: flex;
                          justify-content: space-between;
                          margin-bottom: 12px;
                          color: #15803d;
                        "
                      >
                        <span>
                          Loyalty Discount
                          ${
                            loyaltyPointsRedeemed > 0
                              ? `(${loyaltyPointsRedeemed.toLocaleString()} points)`
                              : ""
                          }
                        </span>

                        <span>
                          - GHS ${loyaltyDiscountAmount.toFixed(2)}
                        </span>
                      </div>
                    `
                    : ""
                }

                ${
                  discountAmount > 0 &&
                  !order.coupon_code &&
                  loyaltyDiscountAmount <= 0
                    ? `
                      <div
                        style="
                          display: flex;
                          justify-content: space-between;
                          margin-bottom: 12px;
                          color: #15803d;
                        "
                      >
                        <span>
                          Discount
                        </span>

                        <span>
                          - GHS ${discountAmount.toFixed(2)}
                        </span>
                      </div>
                    `
                    : ""
                }

                <div
                  style="
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 12px;
                  "
                >
                  <span style="color: #64748b;">
                    Shipping
                  </span>

                  <span>
                    GHS ${shippingFee.toFixed(2)}
                  </span>
                </div>

                <div
                  style="
                    display: flex;
                    justify-content: space-between;
                    font-size: 22px;
                    font-weight: bold;
                    border-top: 1px solid #e5e7eb;
                    padding-top: 16px;
                    margin-top: 16px;
                  "
                >
                  <span>Total Paid</span>

                  <span>
                    GHS ${totalAmount.toFixed(2)}
                  </span>
                </div>

                ${
                  loyaltyPointsRedeemed > 0 || loyaltyPointsEarned > 0
                    ? `
                      <div
                        style="
                          background: #f0fdf4;
                          border: 1px solid #bbf7d0;
                          border-radius: 12px;
                          padding: 16px;
                          margin-top: 24px;
                        "
                      >
                        <h3 style="margin-top: 0; color: #166534;">
                          Loyalty Rewards
                        </h3>

                        ${
                          loyaltyPointsRedeemed > 0
                            ? `
                              <p style="margin: 8px 0;">
                                <strong>Points redeemed:</strong>
                                ${loyaltyPointsRedeemed.toLocaleString()} points
                              </p>

                              <p style="margin: 8px 0;">
                                <strong>Loyalty savings:</strong>
                                GHS ${loyaltyDiscountAmount.toFixed(2)}
                              </p>
                            `
                            : ""
                        }

                        ${
                          loyaltyPointsEarned > 0
                            ? `
                              <p style="margin: 8px 0;">
                                <strong>Points earned from this order:</strong>
                                ${loyaltyPointsEarned.toLocaleString()} points
                              </p>
                            `
                            : ""
                        }
                      </div>
                    `
                    : ""
                }
              </div>

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
      { error: "Failed to send receipt email." },
      { status: 500 }
    );
  }
}