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

function money(currency: string, amount: number) {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function formatStatus(value: string | null | undefined) {
  return (value || "pending").replaceAll("_", " ");
}

function statusClass(value: string | null | undefined) {
  const status = value || "pending";

  if (["paid", "completed", "delivered", "sent", "active"].includes(status)) {
    return "bg-green-100 text-green-700";
  }

  if (["processing", "preparing", "out_for_delivery"].includes(status)) {
    return "bg-blue-100 text-blue-700";
  }

  if (["failed", "cancelled", "returned"].includes(status)) {
    return "bg-red-100 text-red-700";
  }

  if (["refunded", "partial", "full"].includes(status)) {
    return "bg-purple-100 text-purple-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function getButtonClass(buttonStyle: string) {
  if (buttonStyle === "pill") return "rounded-full";
  if (buttonStyle === "sharp") return "rounded-none";
  if (buttonStyle === "soft") return "rounded-xl";
  return "rounded-2xl";
}

export default async function DashboardOverviewPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    redirect("/onboarding");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,name,slug,logo_url,banner_url,currency")
    .eq("id", profile.tenant_id)
    .single();

  if (!tenant) {
    redirect("/onboarding");
  }

  await supabase.rpc("ensure_storefront_settings", {
    p_tenant_id: tenant.id,
  });

  const { data: storefrontSettingsData } = await supabase
    .from("storefront_settings")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .maybeSingle();

  const storefrontSettings: StorefrontSettings = {
    ...defaultStorefrontSettings,
    ...(storefrontSettingsData || {}),
  };

  const currency = tenant.currency || "GHS";

  const [
    ordersCountResult,
    productsCountResult,
    customersCountResult,
    notificationsCountResult,
    emailQueueCountResult,
    recentOrdersResult,
    paidOrdersResult,
    productsResult,
    variantsResult,
    pendingEmailResult,
    pendingOrdersResult,
    deliveryOrdersResult,
    failedEmailsResult,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),

    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),

    supabase
      .from("customer_profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),

    supabase
      .from("customer_notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "unread"),

    supabase
      .from("notification_email_queue")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "pending"),

    supabase
      .from("orders")
      .select(`
        id,
        customer_name,
        customer_email,
        total_amount,
        status,
        payment_status,
        delivery_status,
        created_at
      `)
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(6),

    supabase
      .from("orders")
      .select("total_amount")
      .eq("tenant_id", tenant.id)
      .eq("payment_status", "paid"),

    supabase
      .from("products")
      .select("id,name,image_url,inventory,low_stock_threshold,status")
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .order("inventory", { ascending: true })
      .limit(8),

    supabase
      .from("product_variants")
      .select(`
        id,
        name,
        option_name,
        option_value,
        inventory,
        low_stock_threshold,
        status,
        product:products (
          id,
          name
        )
      `)
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .order("inventory", { ascending: true })
      .limit(8),

    supabase
      .from("notification_email_queue")
      .select("id,to_email,subject,type,status,attempts,max_attempts,created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "pending"),

    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .in("delivery_status", ["pending", "preparing", "out_for_delivery"]),

    supabase
      .from("notification_email_queue")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "failed"),
  ]);

  const totalOrders = ordersCountResult.count || 0;
  const totalProducts = productsCountResult.count || 0;
  const totalCustomers = customersCountResult.count || 0;
  const unreadNotifications = notificationsCountResult.count || 0;
  const pendingEmails = emailQueueCountResult.count || 0;
  const pendingOrders = pendingOrdersResult.count || 0;
  const activeDeliveries = deliveryOrdersResult.count || 0;
  const failedEmails = failedEmailsResult.count || 0;

  const totalRevenue = (paidOrdersResult.data || []).reduce(
    (sum: number, order: any) => sum + Number(order.total_amount || 0),
    0
  );

  const recentOrders = recentOrdersResult.data || [];

  const lowStockProducts = (productsResult.data || []).filter(
    (product: any) =>
      Number(product.inventory || 0) <=
      Number(product.low_stock_threshold || 5)
  );

  const lowStockVariants = (variantsResult.data || []).filter(
    (variant: any) =>
      Number(variant.inventory || 0) <= Number(variant.low_stock_threshold || 5)
  );

  const lowStockItems = [
    ...lowStockProducts.map((product: any) => ({
      id: product.id,
      name: product.name,
      type: "Product",
      inventory: Number(product.inventory || 0),
      threshold: Number(product.low_stock_threshold || 5),
    })),
    ...lowStockVariants.map((variant: any) => {
      const product = Array.isArray(variant.product)
        ? variant.product[0]
        : variant.product;

      return {
        id: variant.id,
        name: `${product?.name || "Product"} — ${
          variant.option_value || variant.name
        }`,
        type: "Variant",
        inventory: Number(variant.inventory || 0),
        threshold: Number(variant.low_stock_threshold || 5),
      };
    }),
  ].slice(0, 6);

  const pendingEmailItems = pendingEmailResult.data || [];

  const heroImage =
    storefrontSettings.hero_image_url || tenant.banner_url || null;

  return (
    <div className="space-y-8">
      <section
        className="relative overflow-hidden rounded-[2rem] p-8 text-white shadow-sm"
        style={{
          backgroundColor: storefrontSettings.primary_color,
        }}
      >
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(circle at top right, ${storefrontSettings.accent_color}55, transparent 35%), radial-gradient(circle at top left, rgba(168,85,247,0.22), transparent 35%)`,
          }}
        />

        {heroImage && (
          <img
            src={heroImage}
            alt={`${tenant.name} dashboard banner`}
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}

        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
          <div className="lg:col-span-2">
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Merchant command center
            </div>

            <div className="flex items-center gap-4">
              {tenant.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="h-16 w-16 rounded-2xl border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-slate-950">
                  {tenant.name.slice(0, 1)}
                </div>
              )}

              <div>
                <p className="text-sm text-slate-300">Welcome back</p>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                  {tenant.name}
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              Track sales, manage orders, monitor stock, follow customer
              activity, customize your storefront, and keep your store running
              from one overview.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href={`/store/${tenant.slug}`}
                className={`${getButtonClass(
                  storefrontSettings.button_style
                )} bg-white px-6 py-4 text-center font-semibold`}
                style={{
                  color: storefrontSettings.primary_color,
                }}
              >
                View storefront
              </a>

              <a
                href="/settings/storefront"
                className={`${getButtonClass(
                  storefrontSettings.button_style
                )} border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10`}
              >
                Customize storefront
              </a>

              <a
                href="/orders"
                className={`${getButtonClass(
                  storefrontSettings.button_style
                )} border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10`}
              >
                View orders
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-sm text-slate-300">Today’s focus</p>
            <h2 className="mt-2 text-2xl font-bold">Keep operations moving</h2>

            <div className="mt-5 space-y-3">
              <FocusItem
                label="Pending orders"
                value={`${pendingOrders}`}
                href="/orders"
              />
              <FocusItem
                label="Active deliveries"
                value={`${activeDeliveries}`}
                href="/orders"
              />
              <FocusItem
                label="Pending emails"
                value={`${pendingEmails}`}
                href="/dashboard/marketing/email-queue"
              />
              <FocusItem
                label="Low stock items"
                value={`${lowStockItems.length}`}
                href="/products"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={money(currency, totalRevenue)}
          helper="Paid orders"
        />
        <StatCard label="Orders" value={totalOrders} helper="Total orders" />
        <StatCard
          label="Customers"
          value={totalCustomers}
          helper="Customer profiles"
        />
        <StatCard
          label="Products"
          value={totalProducts}
          helper="Listed products"
        />
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <MiniStat
          label="Pending orders"
          value={pendingOrders}
          tone="yellow"
        />
        <MiniStat
          label="Active deliveries"
          value={activeDeliveries}
          tone="blue"
        />
        <MiniStat
          label="Unread notifications"
          value={unreadNotifications}
          tone="green"
        />
        <MiniStat label="Failed emails" value={failedEmails} tone="red" />
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p
                className="text-sm font-semibold uppercase tracking-wide"
                style={{
                  color: storefrontSettings.accent_color,
                }}
              >
                Orders
              </p>
              <h2 className="mt-2 text-2xl font-bold">Recent orders</h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest purchases from your storefront.
              </p>
            </div>

            <a
              href="/orders"
              className={`${getButtonClass(
                storefrontSettings.button_style
              )} border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50`}
            >
              View all orders
            </a>
          </div>

          {recentOrders.length === 0 ? (
            <EmptyState text="No orders yet." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="hidden grid-cols-5 gap-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
                <span>Order</span>
                <span>Customer</span>
                <span>Amount</span>
                <span>Payment</span>
                <span>Delivery</span>
              </div>

              <div className="divide-y divide-slate-100">
                {recentOrders.map((order: any) => (
                  <a
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="grid grid-cols-1 gap-3 px-4 py-4 transition hover:bg-slate-50 md:grid-cols-5 md:items-center"
                  >
                    <div>
                      <p className="font-semibold">#{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-slate-500">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString()
                          : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium">
                        {order.customer_name || "Customer"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {order.customer_email || "No email"}
                      </p>
                    </div>

                    <p className="font-bold">
                      {money(currency, Number(order.total_amount || 0))}
                    </p>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(
                        order.payment_status
                      )}`}
                    >
                      {formatStatus(order.payment_status)}
                    </span>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(
                        order.delivery_status
                      )}`}
                    >
                      {formatStatus(order.delivery_status)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Inventory
            </p>
            <h2 className="mt-2 text-2xl font-bold">Low stock alerts</h2>
            <p className="mt-1 text-sm text-slate-500">
              Products and variants needing restock.
            </p>
          </div>

          {lowStockItems.length === 0 ? (
            <EmptyState text="No low stock items right now." />
          ) : (
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.type} · Threshold {item.threshold}
                      </p>
                    </div>

                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                      {item.inventory} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <a
            href="/products"
            className={`${getButtonClass(
              storefrontSettings.button_style
            )} mt-5 block px-5 py-3 text-center text-sm font-semibold text-white hover:opacity-90`}
            style={{
              backgroundColor: storefrontSettings.primary_color,
            }}
          >
            Manage inventory
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p
              className="text-sm font-semibold uppercase tracking-wide"
              style={{
                color: storefrontSettings.accent_color,
              }}
            >
              Storefront
            </p>
            <h2 className="mt-2 text-2xl font-bold">Brand setup</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your current storefront theme and branding status.
            </p>
          </div>

          <div
            className="overflow-hidden rounded-3xl border border-slate-200"
            style={{
              backgroundColor: storefrontSettings.background_color,
              color: storefrontSettings.text_color,
            }}
          >
            <div
              className="p-5 text-white"
              style={{
                backgroundColor: storefrontSettings.primary_color,
              }}
            >
              <div className="flex items-center gap-3">
                {tenant.logo_url ? (
                  <img
                    src={tenant.logo_url}
                    alt={tenant.name}
                    className="h-11 w-11 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-950">
                    {tenant.name.slice(0, 1)}
                  </div>
                )}

                <div>
                  <p className="font-bold">{tenant.name}</p>
                  <p className="text-xs text-white/70">
                    {storefrontSettings.theme_preset.replaceAll("_", " ")}
                  </p>
                </div>
              </div>

              <div
                className="mt-5 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                style={{
                  backgroundColor: storefrontSettings.accent_color,
                }}
              >
                Accent color preview
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3">
            <a
              href="/settings/storefront"
              className={`${getButtonClass(
                storefrontSettings.button_style
              )} px-5 py-3 text-center text-sm font-semibold text-white hover:opacity-90`}
              style={{
                backgroundColor: storefrontSettings.primary_color,
              }}
            >
              Customize design
            </a>

            <a
              href={`/store/${tenant.slug}`}
              className={`${getButtonClass(
                storefrontSettings.button_style
              )} border border-slate-200 px-5 py-3 text-center text-sm font-semibold hover:bg-slate-50`}
            >
              Open storefront
            </a>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Email queue
            </p>
            <h2 className="mt-2 text-2xl font-bold">Pending emails</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recent notification emails waiting to send.
            </p>
          </div>

          {pendingEmailItems.length === 0 ? (
            <EmptyState text="No queued emails." />
          ) : (
            <div className="space-y-3">
              {pendingEmailItems.map((item: any) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.subject}</p>
                      <p className="truncate text-xs text-slate-500">
                        {item.to_email}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Attempts: {item.attempts}/{item.max_attempts}
                  </p>
                </div>
              ))}
            </div>
          )}

          <a
            href="/dashboard/marketing/email-queue"
            className={`${getButtonClass(
              storefrontSettings.button_style
            )} mt-5 block border border-slate-200 px-5 py-3 text-center text-sm font-semibold hover:bg-slate-50`}
          >
            Open email queue
          </a>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
              Quick actions
            </p>
            <h2 className="mt-2 text-2xl font-bold">Run your store faster</h2>
            <p className="mt-1 text-sm text-slate-500">
              Jump into important store tools.
            </p>
          </div>

          <div className="space-y-3">
            <QuickAction
              title="Add or edit products"
              text="Catalog, pricing, stock, variants, and images."
              href="/products"
            />
            <QuickAction
              title="Review orders"
              text="Delivery status, refunds, and customer updates."
              href="/orders"
            />
            <QuickAction
              title="Send announcements"
              text="Coupon campaigns and customer notifications."
              href="/dashboard/marketing/announcement"
            />
            <QuickAction
              title="Check analytics"
              text="Sales, customers, and store activity."
              href="/analytics"
            />
          </div>
        </div>
      </section>
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">{value}</h2>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "yellow" | "blue" | "green" | "red";
}) {
  const toneClass = {
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-800",
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm opacity-80">{label}</p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}

function FocusItem({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 hover:bg-white/15"
    >
      <span className="text-sm text-slate-300">{label}</span>
      <span className="font-bold">{value}</span>
    </a>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function QuickAction({
  title,
  text,
  href,
}: {
  title: string;
  text: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-1 hover:bg-white hover:shadow-md"
    >
      <h3 className="font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </a>
  );
}