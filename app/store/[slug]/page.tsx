import { getTenantBySlug, Tenant } from "@/lib/getTenantBySlug";
import { createClient } from "@supabase/supabase-js";

type Product = {
  id: string;
  name: string;
  price: number;
  tenant_id: string;
  description?: string;
};

export default async function StorePage({
  params,
}: {
  params: { slug: string };
}) {
  const tenant: Tenant = await getTenantBySlug(params.slug);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenant.id);

  const products = data as Product[] | null;

  if (error) {
    throw error;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">{tenant.name}</h1>
        <p className="mt-3 text-lg text-slate-600">
          Welcome to the {tenant.name} storefront. Browse products below.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {products?.length ? (
          products.map((product) => (
            <article
              key={product.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-2xl font-semibold">{product.name}</h2>
              <p className="mt-4 text-slate-700">
                {product.description ?? "No description available."}
              </p>
              <p className="mt-6 text-xl font-semibold text-slate-900">
                ${product.price.toFixed(2)}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-xl font-medium text-slate-700">No products found for this store.</p>
          </div>
        )}
      </section>
    </main>
  );
}
