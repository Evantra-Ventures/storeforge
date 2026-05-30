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

export default async function WishlistPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
          currency
        )
      )
    `)
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  const items =
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <a href="/" className="text-2xl font-bold">
            StoreForge
          </a>

          <div className="flex items-center gap-4 flex-wrap lg:justify-end">
            <a href="/" className="text-sm text-slate-500 hover:text-black">
              Continue Shopping
            </a>

            <a
              href="/my-orders"
              className="text-sm text-slate-500 hover:text-black"
            >
              My Orders
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
          <h1 className="text-4xl font-bold">My Wishlist</h1>
          <p className="text-slate-500 mt-2">
            Products you saved from different stores. You’ll be notified when
            wishlisted products come back in stock or drop in price.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
          <StatCard label="Saved Items" value={totalItems} />
          <StatCard label="Active Products" value={activeItems} />
          <StatCard label="Low Stock" value={lowStockItems} />
          <StatCard label="Out of Stock" value={outOfStockItems} />
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-3xl border p-16 text-center">
            <h2 className="text-2xl font-bold">No wishlist items yet</h2>
            <p className="text-slate-500 mt-3">
              Save products you like and they will appear here.
            </p>

            <a
              href="/"
              className="inline-block bg-black text-white px-6 py-3 rounded-xl mt-6"
            >
              Start Shopping
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map((item: any) => {
              const product = item.product;
              const tenant = item.tenant;
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

              const lowestVariantPrice =
                hasVariants
                  ? Math.min(
                      ...activeVariants.map(
                        (variant: ProductVariant) =>
                          Number(product.price || 0) +
                          Number(variant.price_adjustment || 0)
                      )
                    )
                  : Number(product.price || 0);

              const highestVariantPrice =
                hasVariants
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
                <div
                  key={item.id}
                  className="bg-white rounded-3xl border overflow-hidden hover:shadow-lg transition"
                >
                  <a
                    href={`/store/${tenant.slug}/products/${product.id}`}
                    className="block aspect-square bg-slate-100 overflow-hidden"
                  >
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
                  </a>

                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">{tenant.name}</p>

                      <span
                        className={`text-xs px-2 py-1 rounded-full capitalize ${
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

                    <h2 className="text-xl font-bold mt-3">{product.name}</h2>

                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {product.description || "No description"}
                    </p>

                    <div className="flex items-center justify-between mt-5">
                      <p className="text-xl font-bold">{displayPrice}</p>

                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
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

                    <div className="mt-4 bg-slate-50 rounded-2xl p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">
                          Available stock
                        </span>
                        <span className="font-medium">
                          {effectiveInventory}
                        </span>
                      </div>

                      {hasVariants && (
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-slate-500">
                            Active variants
                          </span>
                          <span className="font-medium">
                            {activeVariants.length}
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-slate-500 mt-3">
                        Saved on {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {hasVariants && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium">
                          Available options
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {activeVariants.slice(0, 4).map(
                            (variant: ProductVariant) => {
                              const variantPrice =
                                Number(product.price || 0) +
                                Number(variant.price_adjustment || 0);

                              return (
                                <span
                                  key={variant.id}
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    Number(variant.inventory || 0) > 0
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {variant.option_value} · {currency}{" "}
                                  {variantPrice.toFixed(2)}
                                </span>
                              );
                            }
                          )}

                          {activeVariants.length > 4 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                              +{activeVariants.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={`/store/${tenant.slug}/products/${product.id}`}
                        className="bg-black text-white py-3 rounded-xl text-center text-sm font-medium hover:opacity-90"
                      >
                        View Product
                      </a>

                      <a
                        href={`/store/${tenant.slug}`}
                        className="border px-4 py-3 rounded-xl text-sm text-center hover:bg-slate-100"
                      >
                        Store
                      </a>

                      <RemoveWishlistButton wishlistId={item.id} />
                    </div>
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-3xl border p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="text-3xl font-bold mt-2">{value}</h2>
    </div>
  );
}