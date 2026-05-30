import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type Props = {
  params: {
    slug: string;
    categorySlug: string;
  };
  searchParams?: {
    q?: string;
  };
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

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("slug", params.categorySlug)
    .single();

  if (!category) {
    notFound();
  }

  let productsQuery = supabase
    .from("products")
    .select("*")
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <a href={`/store/${tenant.slug}`} className="flex items-center gap-4">
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
              <p className="text-sm text-slate-500">Back to store</p>
            </div>
          </a>

          <div className="flex items-center gap-4">
            <a href="/my-orders" className="text-sm text-slate-500 hover:text-black">
              My Orders
            </a>

            <a
              href="/cart"
              className="bg-black text-white px-4 py-2 rounded-xl text-sm hover:opacity-90 transition"
            >
              Cart
            </a>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <a
          href={`/store/${tenant.slug}`}
          className="text-sm text-slate-500 hover:text-black"
        >
          ← All products
        </a>

        <h2 className="text-5xl font-bold leading-tight mt-6">
          {category.name}
        </h2>

        <p className="mt-6 text-slate-600 text-lg">
          Browse products in this collection.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-8">
        <form
          action={`/store/${tenant.slug}/categories/${category.slug}`}
          className="bg-white border rounded-2xl p-4 flex flex-col md:flex-row gap-3"
        >
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder={`Search ${category.name}...`}
            className="flex-1 border rounded-xl p-3"
          />

          <button className="bg-black text-white px-6 py-3 rounded-xl">
            Search
          </button>

          {searchQuery && (
            <a
              href={`/store/${tenant.slug}/categories/${category.slug}`}
              className="border px-6 py-3 rounded-xl text-center"
            >
              Reset
            </a>
          )}
        </form>
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
            <p className="text-slate-500">No products found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product: any) => (
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
                  <h4 className="font-semibold text-lg">{product.name}</h4>

                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                    {product.description}
                  </p>

                  <div className="mt-5 flex items-center justify-between">
                    <p className="text-xl font-bold">
                      ${Number(product.price).toFixed(2)}
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}