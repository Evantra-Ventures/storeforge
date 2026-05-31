import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import ReorderButton from "@/components/ReorderButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type StorefrontSettings = {
  id: string;
  tenant_id: string;
  theme_preset: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  hero_layout: string;
  product_card_style: string;
  category_style: string;
  button_style: string;
  show_search: boolean;
  show_categories: boolean;
  show_featured_products: boolean;
  show_trust_cards: boolean;
  show_reviews_section: boolean;
  show_loyalty_banner: boolean;
  show_coupon_banner: boolean;
  hero_badge: string | null;
  hero_heading: string | null;
  hero_subheading: string | null;
  featured_section_title: string | null;
  featured_section_subtitle: string | null;
  products_section_title: string | null;
  products_section_subtitle: string | null;
  hero_image_url: string | null;
  promotional_banner_url: string | null;
  status: string;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  currency: string | null;
};

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
        option_value: string | null;
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

const defaultStorefrontSettings: StorefrontSettings = {
  id: "default",
  tenant_id: "default",
  theme_preset: "modern_dark",
  primary_color: "#020617",
  accent_color: "#2563eb",
  background_color: "#f8fafc",
  text_color: "#0f172a",
  hero_layout: "split",
  product_card_style: "rounded",
  category_style: "pills",
  button_style: "rounded",
  show_search: true,
  show_categories: true,
  show_featured_products: true,
  show_trust_cards: true,
  show_reviews_section: true,
  show_loyalty_banner: true,
  show_coupon_banner: true,
  hero_badge: "Live store · Powered by StoreForge",
  hero_heading: null,
  hero_subheading: null,
  featured_section_title: "Popular right now",
  featured_section_subtitle: "Explore featured products from this store.",
  products_section_title: "Shop products",
  products_section_subtitle: "Browse products, options, and collections.",
  hero_image_url: null,
  promotional_banner_url: null,
  status: "active",
};

function money(amount: number, currency = "GHS") {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function formatStatus(value: string | null) {
  return (value || "pending").replaceAll("_", " ");
}

function getButtonClass(buttonStyle: string) {
  if (buttonStyle === "pill") return "rounded-full";
  if (buttonStyle === "sharp") return "rounded-none";
  if (buttonStyle === "soft") return "rounded-xl";
  return "rounded-2xl";
}

function getStatusBadgeClass(status: string | null) {
  const value = status || "pending";

  if (["paid", "completed", "delivered"].includes(value)) {
    return "bg-green-100 text-green-700";
  }

  if (["processing", "preparing", "out_for_delivery"].includes(value)) {
    return "bg-blue-100 text-blue-700";
  }

  if (["failed", "cancelled", "returned", "full"].includes(value)) {
    return "bg-red-100 text-red-700";
  }

  if (["refunded", "partial"].includes(value)) {
    return "bg-purple-100 text-purple-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function mergeSettings(settings?: StorefrontSettings | null) {
  return {
    ...defaultStorefrontSettings,
    ...(settings || {}),
  };
}

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
        logo_url,
        banner_url,
        currency
      )
    `)
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const normalizedOrders =
    orders?.map((order: any) => {
      const tenant = Array.isArray(order.tenant)
        ? order.tenant[0]
        : order.tenant;

      return {
        ...order,
        tenant,
      };
    }) || [];

  const orderIds = normalizedOrders.map((order: any) => order.id);

  const tenantIds = Array.from(
    new Set(
      normalizedOrders
        .map((order: any) => order.tenant?.id)
        .filter(Boolean)
    )
  );

  let settingsByTenant: Record<string, StorefrontSettings> = {};

  if (tenantIds.length > 0) {
    const { data: settingsRows } = await supabase
      .from("storefront_settings")
      .select("*")
      .in("tenant_id", tenantIds)
      .eq("status", "active");

    settingsByTenant = (settingsRows || []).reduce(
      (acc: Record<string, StorefrontSettings>, row: StorefrontSettings) => {
        acc[row.tenant_id] = mergeSettings(row);
        return acc;
      },
      {}
    );
  }

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

  const getProduct = (item: OrderItem) => {
    if (!item.product) return null;
    return Array.isArray(item.product) ? item.product[0] : item.product;
  };

  const getVariant = (item: OrderItem) => {
    if (!item.variant) return null;
    return Array.isArray(item.variant) ? item.variant[0] : item.variant;
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

  const totalOrders = normalizedOrders.length;

  const paidOrders = normalizedOrders.filter(
    (order: any) => order.payment_status === "paid"
  ).length;

  const activeDeliveries = normalizedOrders.filter((order: any) =>
    ["pending", "preparing", "out_for_delivery"].includes(
      order.delivery_status || "pending"
    )
  ).length;

  const totalSpent = normalizedOrders.reduce(
    (sum: number, order: any) => sum + Number(order.total_amount || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <a href="/" className="text-2xl font-bold tracking-tight">
            StoreForge
          </a>

          <div className="flex flex-wrap items-center gap-4 lg:justify-end">
            <a href="/" className="text-sm text-slate-500 hover:text-slate-950">
              Continue Shopping
            </a>

            <a
              href="/wishlist"
              className="text-sm text-slate-500 hover:text-slate-950"
            >
              Wishlist
            </a>

            <a
              href="/customer/loyalty"
              className="text-sm text-slate-500 hover:text-slate-950"
            >
              My Rewards
            </a>

            <a
              href="/customer/profile"
              className="text-sm text-slate-500 hover:text-slate-950"
            >
              My Profile
            </a>

            <CustomerNotificationBell />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.25),transparent_35%)]" />

          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
            <div className="lg:col-span-2">
              <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
                Customer order center
              </div>

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Track your orders from checkout to delivery.
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
                View your order history, payment status, delivery progress,
                refunds, loyalty rewards, and reorder your favorite products.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href="/"
                  className="rounded-2xl bg-white px-6 py-4 text-center font-semibold text-slate-950 hover:bg-slate-200"
                >
                  Continue shopping
                </a>

                <a
                  href="/customer/loyalty"
                  className="rounded-2xl border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10"
                >
                  View rewards
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white p-4 text-slate-950 shadow-2xl">
              <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
                <p className="text-sm text-slate-300">Order summary</p>

                <h2 className="mt-2 text-4xl font-bold">{totalOrders}</h2>
                <p className="mt-1 text-sm text-slate-300">total order(s)</p>

                <div className="mt-6 space-y-3">
                  <HeroMiniRow label="Paid orders" value={paidOrders} />
                  <HeroMiniRow
                    label="Active deliveries"
                    value={activeDeliveries}
                  />
                  <HeroMiniRow label="Total spent" value={money(totalSpent)} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <StatCard
            label="Total orders"
            value={totalOrders}
            helper="All purchases"
          />
          <StatCard
            label="Paid orders"
            value={paidOrders}
            helper="Successful payments"
          />
          <StatCard
            label="Active deliveries"
            value={activeDeliveries}
            helper="Pending or in progress"
          />
          <StatCard
            label="Total spent"
            value={money(totalSpent)}
            helper="Across all stores"
          />
        </section>

        {normalizedOrders.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              🛍️
            </div>

            <h2 className="text-2xl font-bold">No orders yet</h2>

            <p className="mt-3 text-slate-500">
              Your orders will appear here after checkout.
            </p>

            <a
              href="/"
              className="mt-6 inline-block rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Start shopping
            </a>
          </div>
        ) : (
          <section className="space-y-6">
            {normalizedOrders.map((order: any) => {
              const tenant: Tenant | null = order.tenant || null;

              const settings =
                tenant?.id && settingsByTenant[tenant.id]
                  ? settingsByTenant[tenant.id]
                  : defaultStorefrontSettings;

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
              const currency = order.currency || tenant?.currency || "GHS";

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <div
                    className="h-2"
                    style={{
                      backgroundColor: settings.accent_color,
                    }}
                  />

                  <div className="border-b border-slate-100 p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-3 py-1 text-xs font-medium text-white"
                            style={{
                              backgroundColor: settings.primary_color,
                            }}
                          >
                            #{order.id.slice(0, 8)}
                          </span>

                          <StatusBadge
                            label={formatStatus(order.status)}
                            className={getStatusBadgeClass(order.status)}
                          />

                          <StatusBadge
                            label={`Payment: ${formatStatus(
                              order.payment_status
                            )}`}
                            className={getStatusBadgeClass(
                              order.payment_status
                            )}
                          />

                          <StatusBadge
                            label={`Delivery: ${formatStatus(
                              order.delivery_status
                            )}`}
                            className={getStatusBadgeClass(
                              order.delivery_status
                            )}
                          />

                          {order.refund_status &&
                            order.refund_status !== "none" && (
                              <StatusBadge
                                label={`Refund: ${formatStatus(
                                  order.refund_status
                                )}`}
                                className={getStatusBadgeClass(
                                  order.refund_status
                                )}
                              />
                            )}
                        </div>

                        <div className="mt-5 flex items-center gap-4">
                          {tenant?.logo_url ? (
                            <img
                              src={tenant.logo_url}
                              alt={tenant.name}
                              className="h-12 w-12 rounded-2xl border object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-white"
                              style={{
                                backgroundColor: settings.primary_color,
                              }}
                            >
                              {tenant?.name?.slice(0, 1) || "S"}
                            </div>
                          )}

                          <div>
                            <h2 className="text-xl font-bold text-slate-950">
                              {tenant?.name || "Store"}
                            </h2>

                            <p className="text-sm text-slate-500">
                              Placed{" "}
                              {order.created_at
                                ? new Date(order.created_at).toLocaleString()
                                : "recently"}
                            </p>
                          </div>
                        </div>

                        <p className="mt-4 text-sm capitalize text-slate-500">
                          {order.delivery_method || "delivery"}
                          {order.shipping_area
                            ? ` · ${order.shipping_area}`
                            : ""}
                          {order.shipping_city
                            ? `, ${order.shipping_city}`
                            : ""}
                        </p>
                      </div>

                      <div
                        className="rounded-2xl p-5 lg:text-right"
                        style={{
                          backgroundColor: `${settings.accent_color}10`,
                        }}
                      >
                        <p className="text-xs text-slate-500">Order total</p>
                        <p className="mt-1 text-3xl font-bold text-slate-950">
                          {money(Number(order.total_amount || 0), currency)}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {items.length} item(s)
                        </p>

                        {refundedAmount > 0 && (
                          <p className="mt-2 text-xs font-medium text-red-600">
                            Refunded: {money(refundedAmount, currency)}
                          </p>
                        )}
                      </div>
                    </div>

                    <OrderProgress
                      paymentStatus={order.payment_status}
                      orderStatus={order.status}
                      deliveryStatus={order.delivery_status}
                      settings={settings}
                    />
                  </div>

                  {items.length > 0 && (
                    <div className="space-y-3 p-6">
                      {visibleItems.map((item) => {
                        const product = getProduct(item);
                        const variant = getVariant(item);
                        const imageUrl =
                          variant?.image_url || product?.image_url;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4"
                          >
                            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product?.name || "Product"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-xs text-slate-400">
                                  No image
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-950">
                                {product?.name || "Product"}
                              </p>

                              {variant && (
                                <p
                                  className="mt-1 text-xs font-medium"
                                  style={{
                                    color: settings.accent_color,
                                  }}
                                >
                                  {variant.option_name}: {variant.option_value}
                                </p>
                              )}

                              {variant?.sku && (
                                <p className="mt-1 text-xs text-slate-400">
                                  SKU: {variant.sku}
                                </p>
                              )}

                              <p className="mt-1 text-xs text-slate-500">
                                Qty {item.quantity} ×{" "}
                                {money(Number(item.price || 0), currency)}
                              </p>
                            </div>

                            <p className="text-sm font-bold text-slate-950">
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
                    <div
                      className="mx-6 rounded-2xl border p-4"
                      style={{
                        borderColor: `${settings.accent_color}33`,
                        backgroundColor: `${settings.accent_color}10`,
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p
                            className="font-semibold"
                            style={{
                              color: settings.primary_color,
                            }}
                          >
                            Loyalty rewards
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                            {pointsRedeemed > 0 && (
                              <span className="text-slate-600">
                                Redeemed {pointsRedeemed.toLocaleString()} points
                              </span>
                            )}

                            {loyaltyDiscount > 0 && (
                              <span className="text-slate-600">
                                Saved {money(loyaltyDiscount, currency)}
                              </span>
                            )}

                            {pointsEarned > 0 && (
                              <span className="text-slate-600">
                                Earned {pointsEarned.toLocaleString()} points
                              </span>
                            )}
                          </div>
                        </div>

                        <a
                          href="/customer/loyalty"
                          className="text-sm font-medium hover:underline"
                          style={{
                            color: settings.accent_color,
                          }}
                        >
                          My rewards →
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 p-6 sm:grid-cols-4">
                    <a
                      href={`/order-success/${order.id}`}
                      className={`${getButtonClass(
                        settings.button_style
                      )} py-3 text-center text-sm font-semibold text-white hover:opacity-90`}
                      style={{
                        backgroundColor: settings.primary_color,
                      }}
                    >
                      View details
                    </a>

                    {tenant?.slug ? (
                      <a
                        href={`/store/${tenant.slug}`}
                        className={`${getButtonClass(
                          settings.button_style
                        )} border border-slate-200 py-3 text-center text-sm font-semibold hover:bg-slate-50`}
                      >
                        Shop again
                      </a>
                    ) : (
                      <a
                        href="/"
                        className={`${getButtonClass(
                          settings.button_style
                        )} border border-slate-200 py-3 text-center text-sm font-semibold hover:bg-slate-50`}
                      >
                        Shop again
                      </a>
                    )}

                    <ReorderButton orderId={order.id} storeSlug={tenant?.slug} />

                    <a
                      href="/customer/loyalty"
                      className={`${getButtonClass(
                        settings.button_style
                      )} border border-slate-200 py-3 text-center text-sm font-semibold hover:bg-slate-50`}
                    >
                      Rewards
                    </a>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-950">{value}</h2>
      <p className="mt-2 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function HeroMiniRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function StatusBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${className}`}
    >
      {label}
    </span>
  );
}

function OrderProgress({
  paymentStatus,
  orderStatus,
  deliveryStatus,
  settings,
}: {
  paymentStatus: string | null;
  orderStatus: string | null;
  deliveryStatus: string | null;
  settings: StorefrontSettings;
}) {
  const paid = paymentStatus === "paid" || paymentStatus === "refunded";
  const processing = ["processing", "completed"].includes(orderStatus || "");
  const outForDelivery = ["out_for_delivery", "delivered"].includes(
    deliveryStatus || ""
  );
  const delivered = deliveryStatus === "delivered";

  const steps = [
    {
      label: "Paid",
      complete: paid,
    },
    {
      label: "Processing",
      complete: processing,
    },
    {
      label: "Out for delivery",
      complete: outForDelivery,
    },
    {
      label: "Delivered",
      complete: delivered,
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className="rounded-2xl border p-4"
          style={{
            borderColor: step.complete
              ? `${settings.accent_color}55`
              : "#e2e8f0",
            backgroundColor: step.complete
              ? `${settings.accent_color}10`
              : "#ffffff",
          }}
        >
          <div
            className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
            style={{
              backgroundColor: step.complete
                ? settings.accent_color
                : "#f1f5f9",
              color: step.complete ? "#ffffff" : "#94a3b8",
            }}
          >
            {step.complete ? "✓" : index + 1}
          </div>

          <p
            className="text-sm font-semibold"
            style={{
              color: step.complete ? settings.primary_color : "#64748b",
            }}
          >
            {step.label}
          </p>
        </div>
      ))}
    </div>
  );
}