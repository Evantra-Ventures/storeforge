import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  params: {
    slug: string;
    categorySlug: string;
  };
  searchParams?: {
    q?: string;
  };
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

export async function generateMetadata({ params }: Props) {
  const supabase = createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,name,slug,banner_url")
    .eq("slug", params.slug)
    .single();

  if (!tenant) {
    return {
      title: "Category Not Found",
    };
  }

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("slug", params.categorySlug)
    .single();

  if (!category) {
    return {
      title: "Category Not Found",
    };
  }

  return {
    title: `${category.name} | ${tenant.name}`,
    description: `Shop ${category.name} products from ${tenant.name}.`,
    openGraph: {
      title: `${category.name} | ${tenant.name}`,
      description: `Shop ${category.name} products from ${tenant.name}.`,
      images: tenant.banner_url ? [tenant.banner_url] : [],
    },
  };
}

export default async function StoreCategoryPage({
  params,
  searchParams,
}: Props) {
  const supabase = createClient();

  const searchQuery = searchParams?.q || "";

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!tenant) {
    notFound();
  }

  await supabase.rpc("ensure_storefront_settings", {
    p_tenant_id: tenant.id,
  });

  const { data: settingsData } = await supabase
    .from("storefront_settings")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .maybeSingle();

  const settings: StorefrontSettings = {
    ...defaultStorefrontSettings,
    ...(settingsData || {}),
  };

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("slug", params.categorySlug)
    .single();

  if (!category) {
    notFound();
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  let productsQuery = supabase
    .from("products")
    .select(`
      *,
      variants:product_variants (
        id,
        price_adjustment,
        status
      )
    `)
    .eq("tenant_id", tenant.id)
    .eq("category_id", category.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (searchQuery) {
    productsQuery = productsQuery.or(
      `name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
    );
  }

  const { data: products } = await productsQuery;

  const currency = tenant.currency || "GHS";
  const heroImage =
    settings.hero_image_url || tenant.banner_url || tenant.logo_url || null;

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: settings.background_color,
        color: settings.text_color,
      }}
    >
      <StoreHeader tenant={tenant} settings={settings} />

      <section
        className="relative overflow-hidden text-white"
        style={{
          backgroundColor: settings.primary_color,
        }}
      >
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background: `radial-gradient(circle at top right, ${settings.accent_color}55, transparent 35%), radial-gradient(circle at top left, rgba(168,85,247,0.22), transparent 35%)`,
          }}
        />

        {heroImage && (
          <img
            src={heroImage}
            alt={`${tenant.name} category banner`}
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}

        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:py-20">
          <a
            href={`/store/${tenant.slug}`}
            className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/15"
          >
            ← All products
          </a>

          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              {settings.hero_badge || "Live store · Powered by StoreForge"}
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl">
              {category.name}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Browse products in this collection from {tenant.name}.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <HeroStat label="Products" value={String(products?.length || 0)} />
              <HeroStat
                label="Categories"
                value={String(categories?.length || 0)}
              />
              <HeroStat label="Checkout" value="Secure" />
            </div>
          </div>
        </div>
      </section>

      {settings.show_search && (
        <section className="mx-auto max-w-7xl px-6 py-8">
          <form
            action={`/store/${tenant.slug}/categories/${category.slug}`}
            className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                name="q"
                defaultValue={searchQuery}
                placeholder={`Search ${category.name}...`}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-4 outline-none transition focus:ring-4"
              />

              <button
                className={`${getButtonClass(
                  settings.button_style
                )} px-6 py-4 font-semibold text-white`}
                style={{
                  backgroundColor: settings.accent_color,
                }}
              >
                Search
              </button>

              {searchQuery && (
                <a
                  href={`/store/${tenant.slug}/categories/${category.slug}`}
                  className={`${getButtonClass(
                    settings.button_style
                  )} border border-slate-200 px-6 py-4 text-center font-semibold hover:bg-slate-50`}
                >
                  Reset
                </a>
              )}
            </div>
          </form>
        </section>
      )}

      {settings.show_categories && settings.category_style !== "hidden" && (
        <section className="mx-auto max-w-7xl px-6 pb-8">
          <div
            className={
              settings.category_style === "cards"
                ? "grid grid-cols-2 gap-3 md:grid-cols-4"
                : "flex gap-3 overflow-x-auto pb-2"
            }
          >
            <CategoryChip
              href={`/store/${tenant.slug}`}
              settings={settings}
            >
              All Products
            </CategoryChip>

            {categories?.map((item) => (
              <CategoryChip
                key={item.id}
                href={`/store/${tenant.slug}/categories/${item.slug}`}
                active={item.id === category.id}
                settings={settings}
              >
                {item.name}
              </CategoryChip>
            ))}
          </div>
        </section>
      )}

      {settings.show_trust_cards && (
        <section className="mx-auto max-w-7xl px-6 pb-10">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <TrustCard
              title="Secure checkout"
              description="Pay safely with a checkout flow built for confidence."
              settings={settings}
            />
            <TrustCard
              title="Fast browsing"
              description="Clean category pages and responsive shopping."
              settings={settings}
            />
            <TrustCard
              title="Order updates"
              description="Track orders, delivery status, and notifications."
              settings={settings}
            />
            <TrustCard
              title="Rewards ready"
              description="Earn and redeem loyalty points when enabled."
              settings={settings}
            />
          </div>
        </section>
      )}

      {settings.show_loyalty_banner && (
        <section className="mx-auto max-w-7xl px-6 pb-10">
          <div
            className="rounded-[2rem] p-6 text-white shadow-sm"
            style={{
              backgroundColor: settings.primary_color,
            }}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-white/70">Rewards ready</p>
                <h2 className="mt-2 text-2xl font-bold">
                  Earn points while shopping this category.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                  Sign in to track rewards, save wishlist items, and receive
                  order updates.
                </p>
              </div>

              <a
                href="/customer/loyalty"
                className={`${getButtonClass(
                  settings.button_style
                )} bg-white px-5 py-3 text-center font-semibold`}
                style={{
                  color: settings.primary_color,
                }}
              >
                View rewards
              </a>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-wide"
              style={{
                color: settings.accent_color,
              }}
            >
              Category catalog
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              {searchQuery ? `Search results for "${searchQuery}"` : category.name}
            </h2>

            <p className="mt-2 text-slate-500">
              {searchQuery
                ? `Showing matching products in ${category.name}.`
                : `Browse products in ${category.name}.`}
            </p>
          </div>

          <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
            {products?.length || 0} product(s)
          </span>
        </div>

        {!products || products.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              🛍️
            </div>

            <h3 className="text-xl font-bold">No products found</h3>

            <p className="mt-2 text-slate-500">
              No products were found in this category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {products.map((product: any) => (
              <ProductCard
                key={product.id}
                product={product}
                tenantSlug={tenant.slug}
                currency={currency}
                settings={settings}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StoreHeader({
  tenant,
  settings,
}: {
  tenant: any;
  settings: StorefrontSettings;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <a href={`/store/${tenant.slug}`} className="flex items-center gap-4">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-12 w-12 rounded-2xl border object-cover"
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
              style={{
                backgroundColor: settings.primary_color,
              }}
            >
              {tenant.name?.slice(0, 1) || "S"}
            </div>
          )}

          <div>
            <p className="text-xl font-bold text-slate-950">{tenant.name}</p>
            <p className="text-xs text-slate-500">Category</p>
          </div>
        </a>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href={`/store/${tenant.slug}`}
            className="text-sm text-slate-500 hover:text-slate-950"
          >
            Store
          </a>

          <a
            href="/my-orders"
            className="text-sm text-slate-500 hover:text-slate-950"
          >
            My Orders
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

          <CustomerNotificationBell tenantId={tenant.id} />

          <a
            href={`/store/${tenant.slug}/cart`}
            className={`${getButtonClass(
              settings.button_style
            )} px-4 py-2 text-sm font-medium text-white`}
            style={{
              backgroundColor: settings.primary_color,
            }}
          >
            Cart
          </a>
        </div>
      </div>
    </header>
  );
}

function ProductCard({
  product,
  tenantSlug,
  currency,
  settings,
}: {
  product: any;
  tenantSlug: string;
  currency: string;
  settings: StorefrontSettings;
}) {
  const activeVariants = (product.variants || []).filter(
    (variant: any) => variant.status === "active"
  );

  const lowestPrice = getLowestPrice(product);

  const cardClass =
    settings.product_card_style === "minimal"
      ? "overflow-hidden border-b border-slate-200 bg-white transition hover:bg-slate-50"
      : settings.product_card_style === "bordered"
      ? "group overflow-hidden rounded-3xl border-2 border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
      : settings.product_card_style === "image_focus"
      ? "group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
      : "group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl";

  return (
    <div className={cardClass}>
      <a
        href={`/store/${tenantSlug}/products/${product.id}`}
        className="block aspect-square overflow-hidden bg-slate-100"
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            No Image
          </div>
        )}
      </a>

      <div className="p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {activeVariants.length > 0 && (
            <span
              className="rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{
                backgroundColor: settings.accent_color,
              }}
            >
              {activeVariants.length} option(s)
            </span>
          )}
        </div>

        <h4 className="text-lg font-bold text-slate-950">{product.name}</h4>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
          {product.description || "Explore this product and available options."}
        </p>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-xl font-bold text-slate-950">
            {activeVariants.length > 0 ? "From " : ""}
            {currency} {lowestPrice.toFixed(2)}
          </p>

          <a
            href={`/store/${tenantSlug}/products/${product.id}`}
            className={`${getButtonClass(
              settings.button_style
            )} px-4 py-2 text-sm font-medium text-white`}
            style={{
              backgroundColor: settings.primary_color,
            }}
          >
            View
          </a>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  href,
  active,
  settings,
  children,
}: {
  href: string;
  active?: boolean;
  settings: StorefrontSettings;
  children: ReactNode;
}) {
  const base =
    settings.category_style === "tabs"
      ? "whitespace-nowrap border-b px-5 py-3 text-sm font-medium transition"
      : settings.category_style === "cards"
      ? "rounded-2xl border px-5 py-5 text-sm font-medium transition"
      : "whitespace-nowrap rounded-2xl border px-5 py-3 text-sm font-medium transition";

  return (
    <a
      href={href}
      className={base}
      style={{
        backgroundColor: active ? settings.primary_color : "#ffffff",
        color: active ? "#ffffff" : "#475569",
        borderColor: active ? settings.primary_color : "#e2e8f0",
      }}
    >
      {children}
    </a>
  );
}

function TrustCard({
  title,
  description,
  settings,
}: {
  title: string;
  description: string;
  settings: StorefrontSettings;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white"
        style={{
          backgroundColor: settings.primary_color,
        }}
      >
        ✓
      </div>

      <h3 className="font-bold text-slate-950">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-slate-300">{label}</p>
    </div>
  );
}

function getButtonClass(buttonStyle: string) {
  if (buttonStyle === "pill") return "rounded-full";
  if (buttonStyle === "sharp") return "rounded-none";
  if (buttonStyle === "soft") return "rounded-xl";
  return "rounded-2xl";
}

function getLowestPrice(product: any) {
  const activeVariants = (product.variants || []).filter(
    (variant: any) => variant.status === "active"
  );

  if (activeVariants.length > 0) {
    return Math.min(
      ...activeVariants.map(
        (variant: any) =>
          Number(product.price || 0) + Number(variant.price_adjustment || 0)
      )
    );
  }

  return Number(product.price || 0);
}