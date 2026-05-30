import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import ReorderButton from "@/components/ReorderButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type OrderItem = {
  id: string;
  order_id: string;
  quantity: number;
  price: number;
  variant_id: string | null;
  product:
    | {
        id: string;
        name: string;
        image_url: string | null;
      }
    | {
        id: string;
        name: string;
        image_url: string | null;
      }[]
    | null;
  variant:
    | {
        id: string;
        name: string;
        option_name: string;
        option_value: string;
        image_url: string | null;
        sku: string | null;
      }
    | {
        id: string;
        name: string;
        option_name: string;
        option_value: string | null;
        image_url: string | null;
        sku: string | null;
      }[]
    | null;
};

type LoyaltyRedemption = {
  id: string;
  order_id: string | null;
  points_redeemed: number;
  discount_amount: number;
  free_shipping_applied: boolean;
  status: string;
};

type LoyaltyTransaction = {
  id: string;
  order_id: string | null;
  type: string;
  status: string;
  points: number;
};

export default async function MyOrdersPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: orders } = await supabase
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
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const orderIds = (orders || []).map((order: any) => order.id);

  let orderItems: OrderItem[] = [];
  let loyaltyRedemptions: LoyaltyRedemption[] = [];
  let loyaltyTransactions: LoyaltyTransaction[] = [];

  
  if (orderIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("order_items")
      .select(`
        id,
        order_id,
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
      .in("order_id", orderIds);

    orderItems = (itemsData || []) as OrderItem[];

    const { data: redemptionsData } = await supabase
      .from("loyalty_reward_redemptions")
      .select(`
        id,
        order_id,
        points_redeemed,
        discount_amount,
        free_shipping_applied,
        status
      `)
      .in("order_id", orderIds);

    loyaltyRedemptions = (redemptionsData || []) as LoyaltyRedemption[];

    const { data: transactionsData } = await supabase
      .from("loyalty_transactions")
      .select(`
        id,
        order_id,
        type,
        status,
        points
      `)
      .in("order_id", orderIds)
      .in("type", ["earned", "refund_reversal"])
      .in("status", ["completed", "reversed"]);

    loyaltyTransactions = (transactionsData || []) as LoyaltyTransaction[];
  }

  const money = (amount: number, currency = "GHS") =>
    `${currency} ${Number(amount || 0).toFixed(2)}`;

  const formatStatus = (value: string | null) =>
    (value || "pending").replaceAll("_", " ");

  const getProduct = (item: OrderItem) => {
    if (!item.product) return null;
    return Array.isArray(item.product) ? item.product[0] : item.product;
  };

  const getVariant = (item: OrderItem) => {
    if (!item.variant) return null;
    return Array.isArray(item.variant) ? item.variant[0] : item.variant;
  };

  const getDeliveryBadgeClass = (status: string | null) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-700";
      case "out_for_delivery":
        return "bg-blue-100 text-blue-700";
      case "failed":
      case "returned":
        return "bg-red-100 text-red-700";
      case "preparing":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getPaymentBadgeClass = (status: string | null) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "refunded":
        return "bg-purple-100 text-purple-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const getOrderBadgeClass = (status: string | null) => {
    switch (status) {
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getRefundBadgeClass = (status: string | null) => {
    switch (status) {
      case "full":
        return "bg-red-100 text-red-700";
      case "partial":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getOrderItems = (orderId: string) =>
    orderItems.filter((item) => item.order_id === orderId);

  const getOrderLoyaltyRedemption = (orderId: string) =>
    loyaltyRedemptions.find((item) => item.order_id === orderId) || null;

  const getOrderPointsEarned = (orderId: string) => {
    const earned = loyaltyTransactions.find(
      (item) =>
        item.order_id === orderId &&
        item.type === "earned" &&
        item.status === "completed"
    );

    const reversed = loyaltyTransactions.find(
      (item) => item.order_id === orderId && item.type === "refund_reversal"
    );

    if (reversed) return 0;

    return Number(earned?.points || 0);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <a href="/" className="text-2xl font-bold">
            StoreForge
          </a>

          <div className="flex items-center gap-4 flex-wrap lg:justify-end">
            <a href="/" className="text-sm text-slate-500 hover:text-black">
              Continue Shopping
            </a>

            <a
              href="/wishlist"
              className="text-sm text-slate-500 hover:text-black"
            >
              Wishlist
            </a>

            <a
              href="/customer/loyalty"
              className="text-sm text-slate-500 hover:text-black"
            >
              My Rewards
            </a>

            <a
              href="/customer/profile"
              className="text-sm text-slate-500 hover:text-black"
            >
              My Profile
            </a>

             <CustomerNotificationBell />
             
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold">My Orders</h1>
          <p className="text-slate-500 mt-2">
            View your orders, variants, delivery updates, refunds, and loyalty
            rewards.
          </p>
        </div>

        {!orders || orders.length === 0 ? (
          <div className="bg-white rounded-3xl border p-16 text-center">
            <h2 className="text-2xl font-bold">No orders yet</h2>
            <p className="text-slate-500 mt-3">
              Your orders will appear here after checkout.
            </p>

            <a
              href="/"
              className="inline-block bg-black text-white px-6 py-3 rounded-xl mt-6"
            >
              Start Shopping
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order: any) => {
              const items = getOrderItems(order.id);
              const visibleItems = items.slice(0, 3);
              const hiddenItemCount = Math.max(0, items.length - 3);

              const loyaltyRedemption = getOrderLoyaltyRedemption(order.id);

              const pointsRedeemed = Number(
                loyaltyRedemption?.points_redeemed || 0
              );

              const loyaltyDiscount = Number(
                loyaltyRedemption?.discount_amount || 0
              );

              const pointsEarned = getOrderPointsEarned(order.id);
              const refundedAmount = Number(order.refunded_amount || 0);
              const currency = order.currency || "GHS";

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-3xl border p-6 hover:shadow-lg transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                          #{order.id.slice(0, 8)}
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full text-xs capitalize ${getOrderBadgeClass(
                            order.status
                          )}`}
                        >
                          {formatStatus(order.status)}
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full text-xs capitalize ${getPaymentBadgeClass(
                            order.payment_status
                          )}`}
                        >
                          {formatStatus(order.payment_status)}
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full text-xs capitalize ${getDeliveryBadgeClass(
                            order.delivery_status
                          )}`}
                        >
                          Delivery: {formatStatus(order.delivery_status)}
                        </span>

                        {order.refund_status && (
                          <span
                            className={`px-3 py-1 rounded-full text-xs capitalize ${getRefundBadgeClass(
                              order.refund_status
                            )}`}
                          >
                            Refund: {formatStatus(order.refund_status)}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-500 mt-3">
                        Placed {new Date(order.created_at).toLocaleString()}
                      </p>

                      <p className="text-sm text-slate-500 mt-2 capitalize">
                        {order.delivery_method || "delivery"}
                        {order.shipping_area ? ` · ${order.shipping_area}` : ""}
                        {order.shipping_city ? `, ${order.shipping_city}` : ""}
                      </p>

                      {order.tenant?.name && (
                        <p className="text-sm text-slate-500 mt-2">
                          Store: {order.tenant.name}
                        </p>
                      )}
                    </div>

                    <div className="lg:text-right">
                      <p className="text-2xl font-bold">
                        {money(Number(order.total_amount || 0), currency)}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        {items.length} item(s)
                      </p>

                      {refundedAmount > 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          Refunded: {money(refundedAmount, currency)}
                        </p>
                      )}
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="mt-5 space-y-3">
                      {visibleItems.map((item) => {
                        const product = getProduct(item);
                        const variant = getVariant(item);
                        const imageUrl =
                          variant?.image_url || product?.image_url;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 bg-slate-50 rounded-2xl p-3"
                          >
                            <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product?.name || "Product"}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs text-slate-400">
                                  No image
                                </span>
                              )}
                            </div>

                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {product?.name || "Product"}
                              </p>

                              {variant && (
                                <p className="text-xs text-purple-700 mt-1">
                                  {variant.option_name}: {variant.option_value}
                                </p>
                              )}

                              {variant?.sku && (
                                <p className="text-xs text-slate-400 mt-1">
                                  SKU: {variant.sku}
                                </p>
                              )}

                              <p className="text-xs text-slate-500 mt-1">
                                Qty {item.quantity} ×{" "}
                                {money(Number(item.price || 0), currency)}
                              </p>
                            </div>

                            <p className="font-semibold text-sm">
                              {money(
                                Number(item.price || 0) *
                                  Number(item.quantity || 0),
                                currency
                              )}
                            </p>
                          </div>
                        );
                      })}

                      {hiddenItemCount > 0 && (
                        <p className="text-xs text-slate-500">
                          +{hiddenItemCount} more item(s)
                        </p>
                      )}
                    </div>
                  )}

                  {(pointsRedeemed > 0 ||
                    pointsEarned > 0 ||
                    loyaltyDiscount > 0) && (
                    <div className="mt-5 bg-green-50 border border-green-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-semibold text-green-800">
                            Loyalty Rewards
                          </p>

                          <div className="flex items-center gap-3 flex-wrap mt-2 text-sm">
                            {pointsRedeemed > 0 && (
                              <span className="text-green-700">
                                Redeemed {pointsRedeemed.toLocaleString()}{" "}
                                points
                              </span>
                            )}

                            {loyaltyDiscount > 0 && (
                              <span className="text-green-700">
                                Saved {money(loyaltyDiscount, currency)}
                              </span>
                            )}

                            {pointsEarned > 0 && (
                              <span className="text-green-700">
                                Earned {pointsEarned.toLocaleString()} points
                              </span>
                            )}
                          </div>
                        </div>

                        <a
                          href="/customer/loyalty"
                          className="text-sm font-medium text-green-700 hover:underline"
                        >
                          My Rewards →
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <a
                      href={`/order-success/${order.id}`}
                      className="bg-black text-white py-3 rounded-2xl text-center text-sm font-medium hover:opacity-90"
                    >
                      View Details
                    </a>

                    {order.tenant?.slug ? (
                      <a
                        href={`/store/${order.tenant.slug}`}
                        className="border py-3 rounded-2xl text-center text-sm font-medium hover:bg-slate-100"
                      >
                        Shop Again
                      </a>
                    ) : (
                      <a
                        href="/"
                        className="border py-3 rounded-2xl text-center text-sm font-medium hover:bg-slate-100"
                      >
                        Shop Again
                      </a>
                    )}

                    <ReorderButton
                      orderId={order.id}
                      storeSlug={order.tenant?.slug}
                    />

                    <a
                      href="/customer/loyalty"
                      className="border py-3 rounded-2xl text-center text-sm font-medium hover:bg-slate-100"
                    >
                      Rewards
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}