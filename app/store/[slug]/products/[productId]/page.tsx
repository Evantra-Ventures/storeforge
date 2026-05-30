import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ReviewForm from "@/components/store/ReviewForm";
import ProductPurchaseBox from "@/components/store/ProductPurchaseBox";

type ProductPageProps = {
  params: {
    slug: string;
    productId: string;
  };
};

export async function generateMetadata({ params }: ProductPageProps) {
  const supabase = createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,name,slug")
    .eq("slug", params.slug)
    .single();

  if (!tenant) return { title: "Product Not Found" };

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.productId)
    .eq("tenant_id", tenant.id)
    .single();

  if (!product) return { title: "Product Not Found" };

  const description =
    product.description || `Buy ${product.name} from ${tenant.name}.`;

  return {
    title: `${product.name} | ${tenant.name}`,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.image_url ? [product.image_url] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!tenant) notFound();

  const reviewsEnabled = tenant.reviews_enabled ?? true;
  const reviewModerationEnabled = tenant.review_moderation_enabled ?? false;
  const currency = tenant.currency || "GHS";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  let unreadNotificationsCount = 0;

  if (user) {
    const { count } = await supabase
      .from("customer_notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .eq("status", "unread");

    unreadNotificationsCount = count || 0;
  }

  const { data: product } = await supabase
    .from("products")
    .select(`
      *,
      category:categories (
        id,
        name,
        slug
      )
    `)
    .eq("id", params.productId)
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .single();

  if (!product) notFound();

  const category = Array.isArray(product.category)
    ? product.category[0]
    : product.category;

  const { data: variants } = await supabase
    .from("product_variants")
    .select(
      "id,name,option_name,option_value,price_adjustment,inventory,image_url,status"
    )
    .eq("tenant_id", tenant.id)
    .eq("product_id", product.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const baseInventory = Number(product.inventory || 0);

  const totalVariantInventory = (variants || []).reduce(
    (acc: number, variant: any) => acc + Number(variant.inventory || 0),
    0
  );

  const effectiveInventory =
    variants && variants.length > 0 ? totalVariantInventory : baseInventory;

  const isOutOfStock = effectiveInventory <= 0;

  const isLowStock =
    !isOutOfStock &&
    effectiveInventory <= Number(product.low_stock_threshold || 5);

  const { data: reviews } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("product_id", product.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const averageRating =
    reviews && reviews.length > 0
      ? reviews.reduce(
          (acc: number, review: any) => acc + Number(review.rating),
          0
        ) / reviews.length
      : 0;

  let relatedQuery = supabase
    .from("products")
    .select(`
      *,
      category:categories (
        id,
        name,
        slug
      )
    `)
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .neq("id", product.id)
    .limit(4);

  if (product.category_id) {
    relatedQuery = relatedQuery.eq("category_id", product.category_id);
  }

  const { data: relatedProducts } = await relatedQuery;

  const { data: shippingZones } = await supabase
    .from("shipping_zones")
    .select("id,name,fee,estimated_days")
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .order("fee", { ascending: true })
    .limit(3);

  const whatsappText = encodeURIComponent(
    `Hello, I am interested in ${product.name} from ${tenant.name}.`
  );

  const whatsappHref = tenant.whatsapp_url
    ? tenant.whatsapp_url.includes("?")
      ? `${tenant.whatsapp_url}&text=${whatsappText}`
      : `${tenant.whatsapp_url}?text=${whatsappText}`
    : null;

  const lowestVariantPrice =
    variants && variants.length > 0
      ? Math.min(
          ...variants.map(
            (variant: any) =>
              Number(product.price) + Number(variant.price_adjustment || 0)
          )
        )
      : Number(product.price);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description:
      product.description || `Buy ${product.name} from ${tenant.name}.`,
    image: product.image_url ? [product.image_url] : [],
    sku: product.id,
    brand: {
      "@type": "Brand",
      name: tenant.name,
    },
    category: category?.name,
    offers: {
      "@type": "Offer",
      price: lowestVariantPrice.toFixed(2),
      priceCurrency: currency,
      availability: isOutOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      url: `${siteUrl}/store/${tenant.slug}/products/${product.id}`,
      seller: {
        "@type": "Organization",
        name: tenant.name,
      },
    },
    ...(reviews && reviews.length > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: averageRating.toFixed(1),
            reviewCount: reviews.length,
          },
          review: reviews.slice(0, 5).map((review: any) => ({
            "@type": "Review",
            reviewRating: {
              "@type": "Rating",
              ratingValue: review.rating,
            },
            name: review.title || "Product review",
            reviewBody: review.comment || "",
          })),
        }
      : {}),
  };

  let initialWishlisted = false;

  if (user) {
    const { data: wishlistItem } = await supabase
      .from("wishlists")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("product_id", product.id)
      .eq("customer_id", user.id)
      .maybeSingle();

    initialWishlisted = !!wishlistItem;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
      />

      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <a href={`/store/${tenant.slug}`} className="flex items-center gap-4">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="w-12 h-12 rounded-xl object-cover border"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-200" />
            )}

            <div>
              <p className="text-xl font-bold">{tenant.name}</p>
              <p className="text-xs text-slate-500">Product Details</p>
            </div>
          </a>

          <div className="flex items-center gap-4 flex-wrap">
            <a
              href={`/store/${tenant.slug}`}
              className="text-sm text-slate-500 hover:text-black"
            >
              Store
            </a>

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

      {tenant.banner_url && (
        <section className="max-w-7xl mx-auto px-6 pt-8">
          <div className="h-48 rounded-3xl overflow-hidden border bg-slate-200">
            <img
              src={tenant.banner_url}
              alt={`${tenant.name} banner`}
              className="w-full h-full object-cover"
            />
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-6 py-12">
        <a
          href={`/store/${tenant.slug}`}
          className="inline-block text-sm text-slate-500 hover:text-black mb-8"
        >
          ← Back to Store
        </a>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="bg-white rounded-3xl border overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="aspect-square flex items-center justify-center text-slate-400">
                No Image
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              {category && (
                <a
                  href={`/store/${tenant.slug}/categories/${category.slug}`}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm"
                >
                  {category.name}
                </a>
              )}

              {variants && variants.length > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm">
                  {variants.length} option(s)
                </span>
              )}

              {reviews && reviews.length > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm">
                  ⭐ {averageRating.toFixed(1)} ({reviews.length})
                </span>
              )}

              {isOutOfStock ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm">
                  Out of stock
                </span>
              ) : isLowStock ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm">
                  Low stock
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm">
                  In stock
                </span>
              )}
            </div>

            <h1 className="text-5xl font-bold leading-tight">{product.name}</h1>

            <p className="mt-6 text-slate-600 text-lg leading-relaxed">
              {product.description || "No product description provided."}
            </p>

            <ProductPurchaseBox
              tenantId={tenant.id}
              productId={product.id}
              basePrice={Number(product.price)}
              baseInventory={baseInventory}
              currency={currency}
              variants={variants || []}
              initialWishlisted={initialWishlisted}
            />

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  className="w-full sm:w-auto bg-green-500 text-white px-8 py-4 rounded-2xl font-medium text-center hover:bg-green-600 transition"
                >
                  Ask on WhatsApp
                </a>
              )}

              {tenant.support_phone && (
                <a
                  href={`tel:${tenant.support_phone}`}
                  className="w-full sm:w-auto border px-8 py-4 rounded-2xl font-medium text-center hover:bg-slate-100 transition"
                >
                  Call Store
                </a>
              )}
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border rounded-2xl p-5">
                <h3 className="font-semibold">Store Support</h3>

                <div className="text-sm text-slate-500 mt-3 space-y-1">
                  {tenant.contact_email && <p>Email: {tenant.contact_email}</p>}
                  {tenant.support_phone && <p>Phone: {tenant.support_phone}</p>}
                  {tenant.business_address && (
                    <p>Address: {tenant.business_address}</p>
                  )}
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-5">
                <h3 className="font-semibold">Delivery Preview</h3>

                {!shippingZones || shippingZones.length === 0 ? (
                  <p className="text-sm text-slate-500 mt-3">
                    Delivery fees will be shown at checkout.
                  </p>
                ) : (
                  <div className="text-sm text-slate-500 mt-3 space-y-2">
                    {shippingZones.map((zone) => (
                      <div
                        key={zone.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span>{zone.name}</span>
                        <span className="font-medium text-slate-900">
                          {currency} {Number(zone.fee).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {(tenant.pickup_instructions || tenant.payment_instructions) && (
              <div className="mt-4 bg-white border rounded-2xl p-5">
                <h3 className="font-semibold">Store Instructions</h3>

                {tenant.pickup_instructions && (
                  <p className="text-sm text-slate-500 mt-3">
                    <span className="font-medium text-slate-700">Pickup:</span>{" "}
                    {tenant.pickup_instructions}
                  </p>
                )}

                {tenant.payment_instructions && (
                  <p className="text-sm text-slate-500 mt-3">
                    <span className="font-medium text-slate-700">Payment:</span>{" "}
                    {tenant.payment_instructions}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white border rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Customer Reviews</h2>
                <p className="text-slate-500 mt-1">
                  {reviews?.length || 0} review(s)
                </p>
              </div>

              {reviews && reviews.length > 0 && (
                <p className="text-xl font-bold">
                  ⭐ {averageRating.toFixed(1)}
                </p>
              )}
            </div>

            {!reviews || reviews.length === 0 ? (
              <p className="text-slate-500">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review: any) => (
                  <div key={review.id} className="border rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">
                        {"⭐".repeat(Number(review.rating))}
                      </p>

                      {review.is_verified_purchase && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Verified purchase
                        </span>
                      )}
                    </div>

                    {review.title && (
                      <h3 className="font-bold mt-3">{review.title}</h3>
                    )}

                    {review.comment && (
                      <p className="text-slate-600 mt-2">{review.comment}</p>
                    )}

                    <p className="text-xs text-slate-400 mt-3">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {reviewsEnabled ? (
            <div className="space-y-4">
              {reviewModerationEnabled && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-2xl p-4 text-sm">
                  Reviews for this store are moderated. Your review will appear
                  after approval.
                </div>
              )}

              <ReviewForm productId={product.id} />
            </div>
          ) : (
            <div className="bg-white border rounded-3xl p-6">
              <h3 className="text-xl font-bold">Reviews Disabled</h3>
              <p className="text-slate-500 mt-2">
                This store is not accepting product reviews right now.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Related Products</h2>

          {category && (
            <a
              href={`/store/${tenant.slug}/categories/${category.slug}`}
              className="text-sm text-slate-500 hover:text-black"
            >
              View more in {category.name}
            </a>
          )}
        </div>

        {!relatedProducts || relatedProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center text-slate-500">
            No related products found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((item: any) => {
              const relatedCategory = Array.isArray(item.category)
                ? item.category[0]
                : item.category;

              return (
                <a
                  key={item.id}
                  href={`/store/${tenant.slug}/products/${item.id}`}
                  className="bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition"
                >
                  <div className="aspect-square bg-slate-100">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    {relatedCategory && (
                      <span className="inline-block mb-3 bg-slate-100 px-2 py-1 rounded-md text-xs text-slate-600">
                        {relatedCategory.name}
                      </span>
                    )}

                    <h3 className="font-semibold text-lg">{item.name}</h3>

                    <p className="text-slate-500 text-sm mt-2 line-clamp-2">
                      {item.description}
                    </p>

                    <div className="mt-5 flex items-center justify-between">
                      <p className="font-bold text-xl">
                        {currency} {Number(item.price).toFixed(2)}
                      </p>

                      <span className="text-sm text-slate-500">View</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}