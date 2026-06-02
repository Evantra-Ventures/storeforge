import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type StorePageProps = {
  params: { slug: string };
  searchParams?: { q?: string };
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

function getStoreVisibilityStatus(tenant: any) {
  if (tenant?.store_status) return tenant.store_status;
  if (tenant?.status) return tenant.status;
  if (tenant?.is_published === false) return "draft";
  return "active";
}

function isStorePublic(status: string) {
  return status === "active" || status === "published";
}

function getSafeSearchQuery(value?: string) {
  return (value || "").replace(/[,%]/g, " ").trim();
}

export async function generateMetadata({ params }: StorePageProps) {
  const supabase = createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!tenant) return { title: "Store Not Found" };

  const storeStatus = getStoreVisibilityStatus(tenant);
  const description =
    tenant.description || `Shop products from ${tenant.name} on StoreForge.`;

  if (!isStorePublic(storeStatus)) {
    return {
      title: `${tenant.name} is not available | StoreForge`,
      description: `${tenant.name} is currently not available for public shopping.`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: `${tenant.name} | StoreForge`,
    description,
    openGraph: {
      title: tenant.name,
      description,
      images: tenant.banner_url ? [tenant.banner_url] : [],
    },
  };
}

export default async function StorePage({
  params,
  searchParams,
}: StorePageProps) {
  const supabase = createClient();

  const searchQuery = getSafeSearchQuery(searchParams?.q);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (error || !tenant) notFound();

  const storeStatus = getStoreVisibilityStatus(tenant);

  let canManageStore = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .maybeSingle();

    canManageStore =
      profile?.tenant_id === tenant.id &&
      ["owner", "store_owner", "admin", "super_admin"].includes(
        profile?.role || ""
      );
  }

  if (!isStorePublic(storeStatus) && !canManageStore) {
    return (
      <StoreUnavailable
        tenant={tenant}
        status={storeStatus}
        siteUrl={siteUrl}
      />
    );
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

  const currency = tenant.currency || "GHS";
  const storeUrl = `${siteUrl}/store/${tenant.slug}`;

  const heroHeading = settings.hero_heading || tenant.name;

  const heroSubheading =
    settings.hero_subheading ||
    tenant.description ||
    "Explore our latest products, collections, and offers with a smooth shopping experience from browsing to checkout.";

  const heroImage =
    settings.hero_image_url || tenant.banner_url || tenant.logo_url || null;

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  let productsQuery = supabase
    .from("products")
    .select(`
      *,
      category:categories (
        id,
        name,
        slug
      ),
      variants:product_variants (
        id,
        price_adjustment,
        status
      )
    `)
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (searchQuery) {
    productsQuery = productsQuery.or(
      `name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`
    );
  }

  const { data: products } = await productsQuery;

  const featuredProducts = (products || []).slice(0, 4);
  const totalProducts = products?.length || 0;
  const totalCategories = categories?.length || 0;

  const storeJsonLd = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: tenant.name,
    url: storeUrl,
    description:
      tenant.description || `Shop products from ${tenant.name} on StoreForge.`,
    image: tenant.banner_url || tenant.logo_url || undefined,
    logo: tenant.logo_url || undefined,
    email: tenant.contact_email || undefined,
    telephone: tenant.support_phone || undefined,
    address: tenant.business_address
      ? {
          "@type": "PostalAddress",
          streetAddress: tenant.business_address,
        }
      : undefined,
    sameAs: [
      tenant.facebook_url,
      tenant.instagram_url,
      tenant.whatsapp_url,
    ].filter(Boolean),
    potentialAction: {
      "@type": "SearchAction",
      target: `${storeUrl}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${tenant.name} Products`,
    itemListElement: (products || []).map((product: any, index: number) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${storeUrl}/products/${product.id}`,
      name: product.name,
    })),
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: settings.background_color,
        color: settings.text_color,
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      {canManageStore && !isStorePublic(storeStatus) && (
        <div className="border-b border-yellow-200 bg-yellow-50 px-6 py-3 text-center text-sm text-yellow-800">
          Preview mode: this store is currently{" "}
          <strong className="capitalize">{storeStatus}</strong>. Customers
          cannot access it until it is published/active.
        </div>
      )}

      <StoreHeader tenant={tenant} settings={settings} />

      <main>
        <HeroSection
          tenant={tenant}
          settings={settings}
          heroHeading={heroHeading}
          heroSubheading={heroSubheading}
          heroImage={heroImage}
          featuredProducts={featuredProducts}
          totalProducts={totalProducts}
          totalCategories={totalCategories}
          currency={currency}
        />

        {settings.show_coupon_banner && settings.promotional_banner_url && (
          <section className="mx-auto max-w-7xl px-6 pt-8">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm">
              <img
                src={settings.promotional_banner_url}
                alt={`${tenant.name} promotion`}
                className="h-auto w-full rounded-[1.5rem] object-cover"
              />
            </div>
          </section>
        )}

        {settings.show_search && (
          <section className="mx-auto max-w-7xl px-6 py-8">
            <form
              action={`/store/${tenant.slug}`}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Search products, categories, or collections..."
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-4 outline-none transition focus:ring-4"
                  style={{
                    borderColor: "#e2e8f0",
                  }}
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
                    href={`/store/${tenant.slug}`}
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
                active
                settings={settings}
              >
                All Products
              </CategoryChip>

              {categories?.map((category) => (
                <CategoryChip
                  key={category.id}
                  href={`/store/${tenant.slug}/categories/${category.slug}`}
                  settings={settings}
                >
                  {category.name}
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
                description="Clean product pages and responsive shopping experience."
                settings={settings}
              />
              <TrustCard
                title="Order updates"
                description="Track orders, delivery status, and customer notifications."
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
                    Earn points and unlock better shopping benefits.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                    Sign in to track rewards, redeem points, save wishlist
                    items, and receive customer updates.
                  </p>
                </div>

                <a
                  href={`/customer/loyalty?store=${tenant.slug}`}
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

        <section id="products" className="mx-auto max-w-7xl px-6 pb-20">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p
                className="text-sm font-semibold uppercase tracking-wide"
                style={{
                  color: settings.accent_color,
                }}
              >
                Product catalog
              </p>

              <h3 className="mt-2 text-3xl font-bold tracking-tight">
                {searchQuery
                  ? `Search results for "${searchQuery}"`
                  : settings.products_section_title || "Shop products"}
              </h3>

              <p className="mt-2 text-slate-500">
                {settings.products_section_subtitle ||
                  `Browse products, options, and collections from ${tenant.name}.`}
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

              <h4 className="text-xl font-bold">No products found</h4>

              <p className="mt-2 text-slate-500">
                Try another search or check back when new products are added.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
      </main>
    </div>
  );
}

function StoreUnavailable({
  tenant,
  status,
  siteUrl,
}: {
  tenant: any;
  status: string;
  siteUrl: string;
}) {
  const title =
    status === "paused"
      ? "This store is temporarily paused"
      : status === "suspended"
      ? "This store is currently unavailable"
      : "This store is not live yet";

  const message =
    status === "paused"
      ? "The merchant has temporarily paused this storefront. Please check back later."
      : status === "suspended"
      ? "This storefront cannot be accessed at the moment."
      : "The merchant is still preparing this storefront. Please check back soon.";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-3xl font-bold text-slate-950">
            {tenant?.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-full w-full rounded-3xl object-cover"
              />
            ) : (
              tenant?.name?.slice(0, 1) || "S"
            )}
          </div>

          <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
            StoreForge storefront
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight">{title}</h1>

          <p className="mx-auto mt-4 max-w-xl text-slate-300">{message}</p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="/"
              className="rounded-2xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
            >
              Back to StoreForge
            </a>

            <a
              href={`${siteUrl}`}
              className="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              Explore platform
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

function HeroSection({
  tenant,
  settings,
  heroHeading,
  heroSubheading,
  heroImage,
  featuredProducts,
  totalProducts,
  totalCategories,
  currency,
}: {
  tenant: any;
  settings: StorefrontSettings;
  heroHeading: string;
  heroSubheading: string;
  heroImage: string | null;
  featuredProducts: any[];
  totalProducts: number;
  totalCategories: number;
  currency: string;
}) {
  const isCentered = settings.hero_layout === "centered";
  const isMinimal = settings.hero_layout === "minimal";
  const isBanner = settings.hero_layout === "banner";

  return (
    <section
      className={`relative overflow-hidden text-white ${
        isCentered || isMinimal ? "text-center" : ""
      }`}
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

      {(isBanner || heroImage) && heroImage && (
        <img
          src={heroImage}
          alt={`${tenant.name} hero`}
          className={`absolute inset-0 h-full w-full object-cover ${
            isBanner ? "opacity-35" : "opacity-20"
          }`}
        />
      )}

      <div
        className={`relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-16 lg:py-24 ${
          isCentered || isMinimal
            ? "place-items-center"
            : "lg:grid-cols-2 lg:items-center"
        }`}
      >
        <div className={isCentered || isMinimal ? "max-w-4xl" : ""}>
          <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
            {settings.hero_badge || "Live store · Powered by StoreForge"}
          </div>

          <div
            className={`flex items-center gap-4 ${
              isCentered || isMinimal ? "justify-center" : ""
            }`}
          >
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-16 w-16 rounded-2xl border border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-slate-950">
                {tenant.name?.slice(0, 1) || "S"}
              </div>
            )}

            <div>
              <p className="text-sm text-slate-300">Welcome to</p>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                {heroHeading}
              </h1>
            </div>
          </div>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            {heroSubheading}
          </p>

          <div
            className={`mt-10 flex flex-col gap-4 sm:flex-row ${
              isCentered || isMinimal ? "justify-center" : ""
            }`}
          >
            <a
              href="#products"
              className={`${getButtonClass(
                settings.button_style
              )} bg-white px-7 py-4 text-center font-semibold`}
              style={{
                color: settings.primary_color,
              }}
            >
              Shop products
            </a>

            <a
              href={`/store/${tenant.slug}/cart`}
              className={`${getButtonClass(
                settings.button_style
              )} border border-white/15 px-7 py-4 text-center font-semibold text-white hover:bg-white/10`}
            >
              View cart
            </a>
          </div>

          {!isMinimal && (
            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
              <HeroStat label="Products" value={String(totalProducts)} />
              <HeroStat
                label="Categories"
                value={String(totalCategories)}
              />
              <HeroStat label="Checkout" value="Secure" />
            </div>
          )}
        </div>

        {!isCentered &&
          !isMinimal &&
          settings.show_featured_products &&
          settings.hero_layout !== "banner" && (
            <FeaturedPreview
              tenant={tenant}
              settings={settings}
              featuredProducts={featuredProducts}
              currency={currency}
            />
          )}
      </div>
    </section>
  );
}

function FeaturedPreview({
  tenant,
  settings,
  featuredProducts,
  currency,
}: {
  tenant: any;
  settings: StorefrontSettings;
  featuredProducts: any[];
  currency: string;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
      <div className="rounded-[1.5rem] bg-white p-5 text-slate-950">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm text-slate-500">Featured products</p>
            <h2 className="text-xl font-bold">
              {settings.featured_section_title || "Popular right now"}
            </h2>
          </div>

          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{
              backgroundColor: settings.accent_color,
            }}
          >
            Live
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          {settings.featured_section_subtitle ||
            "Explore featured products from this store."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4">
          {featuredProducts.length > 0 ? (
            featuredProducts.map((product: any) => {
              const lowestPrice = getLowestPrice(product);

              return (
                <a
                  key={product.id}
                  href={`/store/${tenant.slug}/products/${product.id}`}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-slate-100">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  <p className="mt-3 truncate text-sm font-semibold">
                    {product.name}
                  </p>

                  <p className="mt-1 text-sm font-bold">
                    {currency} {lowestPrice.toFixed(2)}
                  </p>
                </a>
              );
            })
          ) : (
            <div className="col-span-2 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Products will appear here once the merchant adds items.
            </div>
          )}
        </div>
      </div>
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
            <p className="text-xs text-slate-500">
              {tenant.contact_email || "Powered by StoreForge"}
            </p>
          </div>
        </a>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href={`/customer/profile?store=${tenant.slug}`}
            className="text-sm text-slate-500 hover:text-slate-950"
          >
            My Profile
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
            href={`/customer/loyalty?store=${tenant.slug}`}
            className="text-sm text-slate-500 hover:text-slate-950"
          >
            My Rewards
          </a>

          <a
            href={`/customer/notifications?store=${tenant.slug}`}
            className="text-sm text-slate-500 hover:text-slate-950"
          >
            Notifications
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
  const category = Array.isArray(product.category)
    ? product.category[0]
    : product.category;

  const activeVariants = (product.variants || []).filter(
    (variant: any) => variant.status === "active"
  );

  const lowestVariantPrice = getLowestPrice(product);

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
          {category && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {category.name}
            </span>
          )}

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
            {currency} {lowestVariantPrice.toFixed(2)}
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

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
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

function getButtonClass(buttonStyle: string) {
  if (buttonStyle === "pill") {
    return "rounded-full";
  }

  if (buttonStyle === "sharp") {
    return "rounded-none";
  }

  if (buttonStyle === "soft") {
    return "rounded-xl";
  }

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