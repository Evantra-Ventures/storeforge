import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type Props = {
  params: {
    orderId: string;
  };
};

export default async function OrderSuccessPage({ params }: Props) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      tenant:tenants (
        id,
        name,
        slug,
        logo_url
      )
    `)
    .eq("id", params.orderId)
    .eq("customer_id", user.id)
    .single();

  if (!order) notFound();

  const { data: orderItems } = await supabase
    .from("order_items")
    .select(`
      id,
      quantity,
      price,
      variant_id,
      product:products (
        id,
        name,
        image_url
      ),
      variant:product_variants (
        id,
        name,
        option_name,
        option_value,
        image_url,
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

  const subtotal =
    order.subtotal_amount ??
    orderItems?.reduce((acc: number, item: any) => {
      return acc + Number(item.price) * Number(item.quantity);
    }, 0) ??
    Number(order.total_amount);

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

  const formatStatus = (value: string | null) =>
    (value || "pending").replaceAll("_", " ");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {order.tenant?.logo_url ? (
              <img
                src={order.tenant.logo_url}
                alt={order.tenant.name}
                className="w-10 h-10 rounded-xl object-cover border"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-200" />
            )}

            <div>
              <p className="font-bold">{order.tenant?.name}</p>
              <p className="text-xs text-slate-500">Order Confirmation</p>
            </div>
          </div>

          <a
            href={`/store/${order.tenant?.slug}`}
            className="text-sm text-slate-500 hover:text-black"
          >
            Continue Shopping
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="bg-white rounded-3xl shadow overflow-hidden">
          <div className="p-10 text-center border-b">
            <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-6 text-4xl">
              ✓
            </div>

            <h1 className="text-4xl font-bold">Order Placed Successfully</h1>

            <p className="text-slate-500 mt-4 text-lg">
              Thank you for your purchase. Your order is now being processed.
            </p>
          </div>

          <div className="p-8 border-b">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-slate-500">Order ID</p>
                <p className="font-semibold mt-1">#{order.id.slice(0, 8)}</p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Payment Status</p>
                <p className="font-semibold mt-1 capitalize">
                  {order.payment_status}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Order Status</p>
                <p className="font-semibold mt-1 capitalize">{order.status}</p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Delivery Status</p>
                <p className="font-semibold mt-1 capitalize">
                  {formatStatus(order.delivery_status)}
                </p>
              </div>
            </div>
          </div>

          {(loyaltyPointsRedeemed > 0 || loyaltyPointsEarned > 0) && (
            <div className="p-8 border-b bg-green-50">
              <h2 className="text-2xl font-bold text-green-800">
                Loyalty Rewards
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 text-sm">
                {loyaltyPointsRedeemed > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-green-200">
                    <p className="text-slate-500">Points Redeemed</p>
                    <p className="font-bold text-green-700 text-2xl mt-1">
                      {loyaltyPointsRedeemed.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Saved GHS {loyaltyDiscountAmount.toFixed(2)} on this
                      order.
                    </p>
                  </div>
                )}

                {loyaltyPointsEarned > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-green-200">
                    <p className="text-slate-500">Points Earned</p>
                    <p className="font-bold text-green-700 text-2xl mt-1">
                      {loyaltyPointsEarned.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Added to your rewards balance.
                    </p>
                  </div>
                )}
              </div>

              <a
                href="/customer/loyalty"
                className="inline-block mt-5 text-sm font-medium text-green-700 hover:underline"
              >
                View My Rewards →
              </a>
            </div>
          )}

          <div className="p-8 border-b">
            <h2 className="text-2xl font-bold mb-6">Delivery Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
              <div>
                <p className="text-slate-500">Delivery Method</p>
                <p className="font-medium capitalize">
                  {order.delivery_method || "delivery"}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Delivery Status</p>
                <p className="font-medium capitalize">
                  {formatStatus(order.delivery_status)}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Shipping Fee</p>
                <p className="font-medium">GHS {shippingFee.toFixed(2)}</p>
              </div>

              <div>
                <p className="text-slate-500">Recipient</p>
                <p className="font-medium">
                  {order.shipping_full_name || order.customer_name || "Customer"}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Phone</p>
                <p className="font-medium">
                  {order.shipping_phone || "Not provided"}
                </p>
              </div>

              {order.delivery_method === "delivery" && (
                <>
                  <div>
                    <p className="text-slate-500">Delivery Area</p>
                    <p className="font-medium">
                      {[
                        order.shipping_area,
                        order.shipping_city,
                        order.shipping_region,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <p className="text-slate-500">Address</p>
                    <p className="font-medium">
                      {order.shipping_address || "Not provided"}
                    </p>
                  </div>
                </>
              )}

              {order.shipping_note && (
                <div className="md:col-span-2">
                  <p className="text-slate-500">Note</p>
                  <p className="font-medium">{order.shipping_note}</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 border-b">
            <h2 className="text-2xl font-bold mb-8">Order Items</h2>

            <div className="space-y-5">
              {orderItems?.map((item: any) => {
                const product = Array.isArray(item.product)
                  ? item.product[0]
                  : item.product;

                const variant = Array.isArray(item.variant)
                  ? item.variant[0]
                  : item.variant;

                const imageUrl = variant?.image_url || product?.image_url;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-100">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product?.name || "Product"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                            No Image
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold">
                          {product?.name || "Product"}
                        </h3>

                        {variant && (
                          <p className="text-sm text-purple-700 mt-1">
                            {variant.option_name}: {variant.option_value}
                          </p>
                        )}

                        {variant?.sku && (
                          <p className="text-xs text-slate-400 mt-1">
                            SKU: {variant.sku}
                          </p>
                        )}

                        <p className="text-sm text-slate-500 mt-1">
                          Qty: {item.quantity} × GHS{" "}
                          {Number(item.price).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <p className="font-bold text-lg">
                      GHS{" "}
                      {(Number(item.price) * Number(item.quantity)).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span>GHS {Number(subtotal).toFixed(2)}</span>
              </div>

              {couponDiscountAmount > 0 && (
                <div className="flex items-center justify-between text-green-700">
                  <span>Coupon Discount ({order.coupon_code})</span>
                  <span>- GHS {couponDiscountAmount.toFixed(2)}</span>
                </div>
              )}

              {loyaltyDiscountAmount > 0 && (
                <div className="flex items-center justify-between text-green-700">
                  <span>
                    Loyalty Discount
                    {loyaltyPointsRedeemed > 0
                      ? ` (${loyaltyPointsRedeemed.toLocaleString()} points)`
                      : ""}
                  </span>
                  <span>- GHS {loyaltyDiscountAmount.toFixed(2)}</span>
                </div>
              )}

              {discountAmount > 0 &&
                !order.coupon_code &&
                loyaltyDiscountAmount <= 0 && (
                  <div className="flex items-center justify-between text-green-700">
                    <span>Discount</span>
                    <span>- GHS {discountAmount.toFixed(2)}</span>
                  </div>
                )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Shipping</span>
                <span>GHS {shippingFee.toFixed(2)}</span>
              </div>

              <div className="border-t pt-4 flex items-center justify-between text-2xl font-bold">
                <span>Total Paid</span>
                <span>GHS {totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a
                href={`/store/${order.tenant?.slug}`}
                className="flex-1 bg-black text-white py-4 rounded-2xl text-center font-medium hover:opacity-90 transition"
              >
                Continue Shopping
              </a>

              <a
                href="/my-orders"
                className="flex-1 border py-4 rounded-2xl text-center font-medium hover:bg-slate-100 transition"
              >
                View My Orders
              </a>

              <a
                href="/customer/loyalty"
                className="flex-1 border py-4 rounded-2xl text-center font-medium hover:bg-slate-100 transition"
              >
                My Rewards
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}