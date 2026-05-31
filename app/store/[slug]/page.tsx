import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type StorePageProps = {
  params: { slug: string };
  searchParams?: { q?: string };
};

export async function generateMetadata({ params }: StorePageProps) {
  const supabase = createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!tenant) return { title: "Store Not Found" };

  const description =
    tenant.description || `Shop products from ${tenant.name} on StoreForge.`;

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

  const searchQuery = searchParams?.q || "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  await supabase.auth.getUser();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (error || !tenant) notFound();

  const currency = tenant.currency || "GHS";
  const storeUrl = `${siteUrl}/store/${tenant.slug}`;

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
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <StoreHeader tenant={tenant} />

      <main>
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%)]" />

          {tenant.banner_url && (
            <img
              src={tenant.banner_url}
              alt={`${tenant.name} banner`}
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
          )}

          <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
                Live store · Powered by StoreForge
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
                    {tenant.name?.slice(0, 1) || "S"}
                  </div>
                )}

                <div>
                  <p className="text-sm text-slate-300">Welcome to</p>
                  <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                    {tenant.name}
                  </h1>
                </div>
              </div>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                {tenant.description ||
                  "Explore our latest products, collections, and offers with a smooth shopping experience from browsing to checkout."}
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#products"
                  className="rounded-2xl bg-white px-7 py-4 text-center font-semibold text-slate-950 hover:bg-slate-200"
                >
                  Shop products
                </a>

                <a
                  href={`/store/${tenant.slug}/cart`}
                  className="rounded-2xl border border-white/15 px-7 py-4 text-center font-semibold text-white hover:bg-white/10"
                >
                  View cart
                </a>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
                <HeroStat label="Products" value={String(totalProducts)} />
                <HeroStat label="Categories" value={String(totalCategories)} />
                <HeroStat label="Checkout" value="Secure" />
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
              <div className="rounded-[1.5rem] bg-white p-5 text-slate-950">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-sm text-slate-500">Featured products</p>
                    <h2 className="text-xl font-bold">Popular right now</h2>
                  </div>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    Live demo
                  </span>
                </div>

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
          </div>
        </section>

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
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />

              <button className="rounded-2xl bg-slate-950 px-6 py-4 font-semibold text-white hover:bg-slate-800">
                Search
              </button>

              {searchQuery && (
                <a
                  href={`/store/${tenant.slug}`}
                  className="rounded-2xl border border-slate-200 px-6 py-4 text-center font-semibold hover:bg-slate-50"
                >
                  Reset
                </a>
              )}
            </div>
          </form>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-8">
          <div className="flex gap-3 overflow-x-auto pb-2">
            <CategoryChip href={`/store/${tenant.slug}`} active>
              All Products
            </CategoryChip>

            {categories?.map((category) => (
              <CategoryChip
                key={category.id}
                href={`/store/${tenant.slug}/categories/${category.slug}`}
              >
                {category.name}
              </CategoryChip>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-10">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <TrustCard
              title="Secure checkout"
              description="Pay safely with a checkout flow built for confidence."
            />
            <TrustCard
              title="Fast browsing"
              description="Clean product pages and responsive shopping experience."
            />
            <TrustCard
              title="Order updates"
              description="Track orders, delivery status, and customer notifications."
            />
            <TrustCard
              title="Rewards ready"
              description="Earn and redeem loyalty points when enabled."
            />
          </div>
        </section>

        <section id="products" className="mx-auto max-w-7xl px-6 pb-20">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Product catalog
              </p>

              <h3 className="mt-2 text-3xl font-bold tracking-tight">
                {searchQuery ? `Search results for "${searchQuery}"` : "Shop products"}
              </h3>

              <p className="mt-2 text-slate-500">
                Browse products, options, and collections from {tenant.name}.
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
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StoreHeader({ tenant }: { tenant: any }) {
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white">
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
            href="/customer/profile"
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
            href="/customer/loyalty"
            className="text-sm text-slate-500 hover:text-slate-950"
          >
            My Rewards
          </a>

          <CustomerNotificationBell tenantId={tenant.id} />

          <a
            href={`/store/${tenant.slug}/cart`}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
}: {
  product: any;
  tenantSlug: string;
  currency: string;
}) {
  const category = Array.isArray(product.category)
    ? product.category[0]
    : product.category;

  const activeVariants = (product.variants || []).filter(
    (variant: any) => variant.status === "active"
  );

  const lowestVariantPrice = getLowestPrice(product);

  return (
    <div className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
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
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
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
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`whitespace-nowrap rounded-2xl border px-5 py-3 text-sm font-medium transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
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
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
        ✓
      </div>

      <h3 className="font-bold text-slate-950">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
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