import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeJsonLd) }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-center gap-4">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="w-14 h-14 rounded-xl object-cover border"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-200" />
            )}

            <div>
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
              <p className="text-sm text-slate-500">
                {tenant.contact_email || "Powered by StoreForge"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <a
              href="/customer/profile"
              className="text-sm text-slate-500 hover:text-black"
            >
              My Profile
            </a>

            <a
              href="/my-orders"
              className="text-sm text-slate-500 hover:text-black"
            >
              My Orders
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

            <a>
              <CustomerNotificationBell tenantId={tenant.id} />
            </a>

            <a
              href={`/store/${tenant.slug}/cart`}
              className="bg-black text-white px-4 py-2 rounded-xl text-sm hover:opacity-90 transition"
            >
              Cart
            </a>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 min-h-[360px] flex items-end">
          {tenant.banner_url ? (
            <img
              src={tenant.banner_url}
              alt={`${tenant.name} banner`}
              className="absolute inset-0 w-full h-full object-cover opacity-70"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-700" />
          )}

          <div className="relative z-10 p-8 md:p-12 max-w-3xl text-white">
            <div className="flex items-center gap-4 mb-6">
              {tenant.logo_url && (
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-white/30"
                />
              )}

              <div>
                <p className="text-sm text-white/70">Welcome to</p>
                <h2 className="text-4xl md:text-6xl font-bold leading-tight">
                  {tenant.name}
                </h2>
              </div>
            </div>

            <p className="text-white/85 text-lg leading-relaxed">
              {tenant.description ||
                "Explore our latest products and collections."}
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-8">
        <form
          action={`/store/${tenant.slug}`}
          className="bg-white border rounded-2xl p-4 flex flex-col md:flex-row gap-3"
        >
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search products..."
            className="flex-1 border rounded-xl p-3"
          />

          <button className="bg-black text-white px-6 py-3 rounded-xl">
            Search
          </button>

          {searchQuery && (
            <a
              href={`/store/${tenant.slug}`}
              className="border px-6 py-3 rounded-xl text-center"
            >
              Reset
            </a>
          )}
        </form>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-8">
        <div className="flex flex-wrap gap-3">
          <a
            href={`/store/${tenant.slug}`}
            className="px-4 py-2 rounded-xl border text-sm bg-black text-white border-black"
          >
            All Products
          </a>

          {categories?.map((category) => (
            <a
              key={category.id}
              href={`/store/${tenant.slug}/categories/${category.slug}`}
              className="px-4 py-2 rounded-xl border text-sm bg-white text-slate-600 hover:bg-slate-100"
            >
              {category.name}
            </a>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold">
            {searchQuery ? `Search results for "${searchQuery}"` : "Products"}
          </h3>

          <span className="text-slate-500">
            {products?.length || 0} Product(s)
          </span>
        </div>

        {!products || products.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border">
            <p className="text-slate-500">No products found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product: any) => {
              const category = Array.isArray(product.category)
                ? product.category[0]
                : product.category;

              const activeVariants = (product.variants || []).filter(
                (variant: any) => variant.status === "active"
              );

              const lowestVariantPrice =
                activeVariants.length > 0
                  ? Math.min(
                      ...activeVariants.map(
                        (variant: any) =>
                          Number(product.price) +
                          Number(variant.price_adjustment || 0)
                      )
                    )
                  : Number(product.price);

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition"
                >
                  <div className="aspect-square bg-slate-100 overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    {category && (
                      <span className="inline-block mb-3 bg-slate-100 px-2 py-1 rounded-md text-xs text-slate-600">
                        {category.name}
                      </span>
                    )}

                    {activeVariants.length > 0 && (
                      <span className="inline-block mb-3 ml-2 bg-purple-100 text-purple-700 px-2 py-1 rounded-md text-xs">
                        {activeVariants.length} option(s)
                      </span>
                    )}

                    <h4 className="font-semibold text-lg">{product.name}</h4>

                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {product.description}
                    </p>

                    <div className="mt-5 flex items-center justify-between">
                      <p className="text-xl font-bold">
                        {activeVariants.length > 0 ? "From " : ""}
                        {currency} {lowestVariantPrice.toFixed(2)}
                      </p>

                      <a
                        href={`/store/${tenant.slug}/products/${product.id}`}
                        className="bg-black text-white px-4 py-2 rounded-xl text-sm hover:opacity-90 transition"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}