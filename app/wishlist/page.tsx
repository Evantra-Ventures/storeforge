import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import RemoveWishlistButton from "@/components/customer/RemoveWishlistButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type ProductVariant = {
  id: string;
  name: string;
  option_name: string;
  option_value: string;
  price_adjustment: number;
  inventory: number;
  image_url: string | null;
  status: string;
};

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

function getButtonClass(buttonStyle: string) {
  if (buttonStyle === "pill") return "rounded-full";
  if (buttonStyle === "sharp") return "rounded-none";
  if (buttonStyle === "soft") return "rounded-xl";
  return "rounded-2xl";
}

function getProductCardClass(productCardStyle: string) {
  if (productCardStyle === "minimal") {
    return "overflow-hidden border-b border-slate-200 bg-white transition hover:bg-slate-50";
  }

  if (productCardStyle === "bordered") {
    return "overflow-hidden rounded-3xl border-2 border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl";
  }

  if (productCardStyle === "image_focus") {
    return "overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl";
  }

  return "overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl";
}

function mergeSettings(settings?: StorefrontSettings | null) {
  return {
    ...defaultStorefrontSettings,
    ...(settings || {}),
  };
}

export default async function WishlistPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/wishlist");

  const { count: unreadNotificationsCount } = await supabase
    .from("customer_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "unread");

  const { data: wishlistItems } = await supabase
    .from("wishlists")
    .select(`
      id,
      tenant_id,
      customer_id,
      product_id,
      created_at,
      product:products (
        id,
        tenant_id,
        name,
        slug,
        description,
        price,
        image_url,
        inventory,
        low_stock_threshold,
        status,
        variants:product_variants (
          id,
          name,
          option_name,
          option_value,
          price_adjustment,
          inventory,
          image_url,
          status
        ),
        tenant:tenants (
          id,
          name,
          slug,
          logo_url,
          banner_url,
          currency
        )
      )
    `)
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const normalizedItems =
    wishlistItems
      ?.map((item: any) => {
        const product = Array.isArray(item.product)
          ? item.product[0]
          : item.product;

        const tenant = Array.isArray(product?.tenant)
          ? product.tenant[0]
          : product?.tenant;

        const variants = Array.isArray(product?.variants)
          ? product.variants
          : [];

        return {
          ...item,
          product: product
            ? {
                ...product,
                variants,
              }
            : null,
          tenant,
        };
      })
      .filter((item) => item.product && item.tenant) || [];

  const tenantIds = Array.from(
    new Set(normalizedItems.map((item: any) => item.tenant.id))
  );

  let settingsByTenant: Record<string, StorefrontSettings> = {};

  if (tenantIds.length > 0) {
    const { data: storefrontSettingsRows } = await supabase
      .from("storefront_settings")
      .select("*")
      .in("tenant_id", tenantIds)
      .eq("status", "active");

    settingsByTenant = (storefrontSettingsRows || []).reduce(
      (acc: Record<string, StorefrontSettings>, row: StorefrontSettings) => {
        acc[row.tenant_id] = mergeSettings(row);
        return acc;
      },
      {}
    );
  }

  const items = normalizedItems.map((item: any) => ({
    ...item,
    storefrontSettings:
      settingsByTenant[item.tenant.id] || defaultStorefrontSettings,
  }));

  const totalItems = items.length;

  const activeItems = items.filter(
    (item: any) => item.product?.status === "active"
  ).length;

  const outOfStockItems = items.filter((item: any) => {
    const product = item.product;

    const activeVariants = (product.variants || []).filter(
      (variant: ProductVariant) => variant.status === "active"
    );

    if (activeVariants.length > 0) {
      const totalVariantInventory = activeVariants.reduce(
        (acc: number, variant: ProductVariant) =>
          acc + Number(variant.inventory || 0),
        0
      );

      return totalVariantInventory <= 0;
    }

    return Number(product.inventory || 0) <= 0;
  }).length;

  const lowStockItems = items.filter((item: any) => {
    const product = item.product;

    const activeVariants = (product.variants || []).filter(
      (variant: ProductVariant) => variant.status === "active"
    );

    if (activeVariants.length > 0) {
      const totalVariantInventory = activeVariants.reduce(
        (acc: number, variant: ProductVariant) =>
          acc + Number(variant.inventory || 0),
        0
      );

      return (
        totalVariantInventory > 0 &&
        totalVariantInventory <= Number(product.low_stock_threshold || 5)
      );
    }

    return (
      Number(product.inventory || 0) > 0 &&
      Number(product.inventory || 0) <= Number(product.low_stock_threshold || 5)
    );
  }).length;

  const recentlySavedItems = items.slice(0, 3);

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
              href="/my-orders"
              className="text-sm text-slate-500 hover:text-slate-950"
            >
              My Orders
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
                Customer wishlist
              </div>

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Save products you love and never miss important updates.
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
                Your wishlist brings together saved products from different
                stores. Track stock availability, price ranges, variants, and
                receive alerts when products return or change.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href="/"
                  className="rounded-2xl bg-white px-6 py-4 text-center font-semibold text-slate-950 hover:bg-slate-200"
                >
                  Continue shopping
                </a>

                <a
                  href="/customer/notifications"
                  className="rounded-2xl border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10"
                >
                  View notifications
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white p-4 text-slate-950 shadow-2xl">
              <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
                <p className="text-sm text-slate-300">Wishlist summary</p>

                <h2 className="mt-2 text-4xl font-bold">{totalItems}</h2>
                <p className="mt-1 text-sm text-slate-300">saved item(s)</p>

                <div className="mt-6 space-y-3">
                  <HeroMiniRow label="Active products" value={activeItems} />
                  <HeroMiniRow label="Low stock" value={lowStockItems} />
                  <HeroMiniRow label="Out of stock" value={outOfStockItems} />
                  <HeroMiniRow
                    label="Unread alerts"
                    value={unreadNotificationsCount || 0}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <StatCard label="Saved Items" value={totalItems} />
          <StatCard label="Active Products" value={activeItems} />
          <StatCard label="Low Stock" value={lowStockItems} />
          <StatCard label="Out of Stock" value={outOfStockItems} />
        </section>

        {recentlySavedItems.length > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  Recently saved
                </p>

                <h2 className="mt-2 text-2xl font-bold">
                  Your latest wishlist picks
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Quick access to products you saved most recently.
                </p>
              </div>

              <a
                href="/customer/notifications"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Notification center
              </a>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {recentlySavedItems.map((item: any) => {
                const product = item.product;
                const tenant = item.tenant;
                const settings = item.storefrontSettings;

                return (
                  <a
                    key={item.id}
                    href={`/store/${tenant.slug}/products/${product.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white hover:shadow-sm"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">No image</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">
                        {product.name}
                      </p>

                      <p className="truncate text-xs text-slate-500">
                        {tenant.name}
                      </p>

                      <span
                        className="mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium text-white"
                        style={{
                          backgroundColor: settings.accent_color,
                        }}
                      >
                        View product
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              💙
            </div>

            <h2 className="text-2xl font-bold">No wishlist items yet</h2>

            <p className="mt-3 text-slate-500">
              Save products you like and they will appear here.
            </p>

            <a
              href="/"
              className="mt-6 inline-block rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Start Shopping
            </a>
          </div>
        ) : (
          <section>
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
                  Saved products
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight">
                  Wishlist products
                </h2>

                <p className="mt-2 text-slate-500">
                  Review stock, variants, price ranges, and visit each store.
                </p>
              </div>

              <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                {totalItems} product(s)
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item: any) => {
                const product = item.product;
                const tenant = item.tenant;
                const settings: StorefrontSettings = item.storefrontSettings;
                const currency = tenant.currency || "GHS";

                const activeVariants = (product.variants || []).filter(
                  (variant: ProductVariant) => variant.status === "active"
                );

                const hasVariants = activeVariants.length > 0;

                const totalVariantInventory = activeVariants.reduce(
                  (acc: number, variant: ProductVariant) =>
                    acc + Number(variant.inventory || 0),
                  0
                );

                const effectiveInventory = hasVariants
                  ? totalVariantInventory
                  : Number(product.inventory || 0);

                const isOutOfStock = effectiveInventory <= 0;

                const isLowStock =
                  !isOutOfStock &&
                  effectiveInventory <= Number(product.low_stock_threshold || 5);

                const lowestVariantPrice = hasVariants
                  ? Math.min(
                      ...activeVariants.map(
                        (variant: ProductVariant) =>
                          Number(product.price || 0) +
                          Number(variant.price_adjustment || 0)
                      )
                    )
                  : Number(product.price || 0);

                const highestVariantPrice = hasVariants
                  ? Math.max(
                      ...activeVariants.map(
                        (variant: ProductVariant) =>
                          Number(product.price || 0) +
                          Number(variant.price_adjustment || 0)
                      )
                    )
                  : Number(product.price || 0);

                const displayPrice =
                  hasVariants && lowestVariantPrice !== highestVariantPrice
                    ? `${currency} ${lowestVariantPrice.toFixed(
                        2
                      )} - ${currency} ${highestVariantPrice.toFixed(2)}`
                    : `${currency} ${lowestVariantPrice.toFixed(2)}`;

                return (
                  <div key={item.id} className={getProductCardClass(settings.product_card_style)}>
                    <a
                      href={`/store/${tenant.slug}/products/${product.id}`}
                      className="block aspect-square overflow-hidden bg-slate-100"
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-500 hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          No Image
                        </div>
                      )}
                    </a>

                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          {tenant.logo_url ? (
                            <img
                              src={tenant.logo_url}
                              alt={tenant.name}
                              className="h-7 w-7 rounded-lg border object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
                              style={{
                                backgroundColor: settings.primary_color,
                              }}
                            >
                              {tenant.name.slice(0, 1)}
                            </div>
                          )}

                          <p className="truncate text-xs text-slate-500">
                            {tenant.name}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-1 text-xs capitalize ${
                            product.status === "active"
                              ? "bg-green-100 text-green-700"
                              : product.status === "draft"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {product.status}
                        </span>
                      </div>

                      <h2 className="mt-3 text-xl font-bold text-slate-950">
                        {product.name}
                      </h2>

                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                        {product.description || "No description"}
                      </p>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <p className="text-xl font-bold text-slate-950">
                          {displayPrice}
                        </p>

                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            isOutOfStock
                              ? "bg-red-100 text-red-700"
                              : isLowStock
                              ? "bg-orange-100 text-orange-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {isOutOfStock
                            ? "Out of stock"
                            : isLowStock
                            ? "Low stock"
                            : "In stock"}
                        </span>
                      </div>

                      <div
                        className="mt-4 rounded-2xl border p-4 text-sm"
                        style={{
                          borderColor: `${settings.accent_color}22`,
                          backgroundColor: `${settings.accent_color}08`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">
                            Available stock
                          </span>
                          <span className="font-medium text-slate-950">
                            {effectiveInventory}
                          </span>
                        </div>

                        {hasVariants && (
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-slate-500">
                              Active variants
                            </span>
                            <span className="font-medium text-slate-950">
                              {activeVariants.length}
                            </span>
                          </div>
                        )}

                        <p className="mt-3 text-xs text-slate-500">
                          Saved on{" "}
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {hasVariants && (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm font-medium text-slate-950">
                            Available options
                          </p>

                          <div className="flex flex-wrap gap-2">
                            {activeVariants
                              .slice(0, 4)
                              .map((variant: ProductVariant) => {
                                const variantPrice =
                                  Number(product.price || 0) +
                                  Number(variant.price_adjustment || 0);

                                return (
                                  <span
                                    key={variant.id}
                                    className="rounded-full px-2 py-1 text-xs"
                                    style={{
                                      backgroundColor:
                                        Number(variant.inventory || 0) > 0
                                          ? `${settings.accent_color}18`
                                          : "#f1f5f9",
                                      color:
                                        Number(variant.inventory || 0) > 0
                                          ? settings.accent_color
                                          : "#64748b",
                                    }}
                                  >
                                    {variant.option_value} · {currency}{" "}
                                    {variantPrice.toFixed(2)}
                                  </span>
                                );
                              })}

                            {activeVariants.length > 4 && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                                +{activeVariants.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <a
                          href={`/store/${tenant.slug}/products/${product.id}`}
                          className={`${getButtonClass(
                            settings.button_style
                          )} py-3 text-center text-sm font-medium text-white hover:opacity-90`}
                          style={{
                            backgroundColor: settings.primary_color,
                          }}
                        >
                          View Product
                        </a>

                        <a
                          href={`/store/${tenant.slug}`}
                          className={`${getButtonClass(
                            settings.button_style
                          )} border border-slate-200 px-4 py-3 text-center text-sm font-medium hover:bg-slate-50`}
                        >
                          Store
                        </a>

                        <div className="sm:col-span-2">
                          <RemoveWishlistButton wishlistId={item.id} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-950">{value}</h2>
    </div>
  );
}