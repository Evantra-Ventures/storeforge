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

function formatMoney(currency: string, amount: number) {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function getRelatedLowestPrice(item: any) {
  const variants = (item.variants || []).filter(
    (variant: any) => variant.status === "active"
  );

  if (variants.length > 0) {
    return Math.min(
      ...variants.map(
        (variant: any) =>
          Number(item.price || 0) + Number(variant.price_adjustment || 0)
      )
    );
  }

  return Number(item.price || 0);
}

export async function generateMetadata({ params }: ProductPageProps) {
  const supabase = createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (!tenant) return { title: "Product Not Found" };

  const storeStatus = getStoreVisibilityStatus(tenant);

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

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.productId)
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
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

  const storeStatus = getStoreVisibilityStatus(tenant);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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

  const reviewsEnabled =
    (tenant.reviews_enabled ?? true) && settings.show_reviews_section;

  const reviewModerationEnabled = tenant.review_moderation_enabled ?? false;
  const currency = tenant.currency || "GHS";

  let productQuery = supabase
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
    .eq("tenant_id", tenant.id);

  if (!canManageStore) {
    productQuery = productQuery.eq("status", "active");
  }

  const { data: product } = await productQuery.single();

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
      ),
      variants:product_variants (
        id,
        price_adjustment,
        status
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
    <div
      className="min-h-screen"
      style={{
        backgroundColor: settings.background_color,
        color: settings.text_color,
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
      />

      {canManageStore && !isStorePublic(storeStatus) && (
        <div className="border-b border-yellow-200 bg-yellow-50 px-6 py-3 text-center text-sm text-yellow-800">
          Preview mode: this store is currently{" "}
          <strong className="capitalize">{storeStatus}</strong>. Customers
          cannot access this product until the store is published/active.
        </div>
      )}

      {canManageStore && product.status !== "active" && (
        <div className="border-b border-orange-200 bg-orange-50 px-6 py-3 text-center text-sm text-orange-800">
          Preview mode: this product is currently{" "}
          <strong className="capitalize">{product.status}</strong>. Customers
          cannot access it until it is active.
        </div>
      )}

      <StoreHeader tenant={tenant} settings={settings} />

      {(tenant.banner_url || settings.hero_image_url) && (
        <section className="mx-auto max-w-7xl px-6 pt-8">
          <div
            className="relative h-48 overflow-hidden rounded-[2rem] border border-slate-200"
            style={{
              backgroundColor: settings.primary_color,
            }}
          >
            <img
              src={settings.hero_image_url || tenant.banner_url}
              alt={`${tenant.name} banner`}
              className="h-full w-full object-cover opacity-70"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right, ${settings.primary_color}dd, transparent)`,
              }}
            />
            <div className="absolute bottom-6 left-6 text-white">
              <p className="text-sm text-white/75">Shopping at</p>
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
            </div>
          </div>
        </section>
      )}

      <main className="mx-auto max-w-7xl px-6 py-10">
        <a
          href={`/store/${tenant.slug}`}
          className={`${getButtonClass(
            settings.button_style
          )} inline-flex items-center border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm hover:text-slate-950`}
        >
          ← Back to store
        </a>

        <section className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm">
              <div className="aspect-square overflow-hidden rounded-[1.5rem] bg-slate-100">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    No Image
                  </div>
                )}
              </div>
            </div>

            {settings.show_trust_cards && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <TrustCard
                  title="Secure checkout"
                  description="Pay safely with trusted checkout."
                  settings={settings}
                />
                <TrustCard
                  title="Order updates"
                  description="Track payment and delivery status."
                  settings={settings}
                />
                <TrustCard
                  title="Rewards ready"
                  description="Earn or redeem points when enabled."
                  settings={settings}
                />
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-28">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                {category && (
                  <a
                    href={`/store/${tenant.slug}/categories/${category.slug}`}
                    className="rounded-full px-3 py-1 text-sm font-medium text-white"
                    style={{
                      backgroundColor: settings.accent_color,
                    }}
                  >
                    {category.name}
                  </a>
                )}

                {variants && variants.length > 0 && (
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
                    {variants.length} option(s)
                  </span>
                )}

                {reviews && reviews.length > 0 && (
                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                    ⭐ {averageRating.toFixed(1)} ({reviews.length})
                  </span>
                )}

                {product.status !== "active" && (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
                    {product.status}
                  </span>
                )}

                {isOutOfStock ? (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                    Out of stock
                  </span>
                ) : isLowStock ? (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
                    Low stock · {effectiveInventory} left
                  </span>
                ) : (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    In stock
                  </span>
                )}
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-950 md:text-5xl">
                {product.name}
              </h1>

              <p className="mt-5 text-lg leading-8 text-slate-600">
                {product.description || "No product description provided."}
              </p>

              <div
                className="mt-6 rounded-3xl border border-slate-200 p-5"
                style={{
                  backgroundColor: `${settings.accent_color}10`,
                }}
              >
                <p className="text-sm text-slate-500">
                  {variants && variants.length > 0
                    ? "Starting from"
                    : "Price"}
                </p>

                <p
                  className="mt-1 text-4xl font-bold"
                  style={{
                    color: settings.primary_color,
                  }}
                >
                  {formatMoney(currency, lowestVariantPrice)}
                </p>

                {variants && variants.length > 0 && (
                  <p className="mt-2 text-sm text-slate-500">
                    Final price may change based on selected option.
                  </p>
                )}
              </div>

              <div className="mt-6">
                {product.status === "active" ? (
                  <ProductPurchaseBox
                    tenantId={tenant.id}
                    productId={product.id}
                    basePrice={Number(product.price)}
                    baseInventory={baseInventory}
                    currency={currency}
                    variants={variants || []}
                    initialWishlisted={initialWishlisted}
                  />
                ) : (
                  <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-800">
                    This product is currently in preview mode and cannot be
                    purchased by customers until it is active.
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-4 sm:flex-row">
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    className={`${getButtonClass(
                      settings.button_style
                    )} flex-1 bg-green-600 px-6 py-4 text-center font-semibold text-white hover:bg-green-700`}
                  >
                    Ask on WhatsApp
                  </a>
                )}

                {tenant.support_phone && (
                  <a
                    href={`tel:${tenant.support_phone}`}
                    className={`${getButtonClass(
                      settings.button_style
                    )} flex-1 border border-slate-200 px-6 py-4 text-center font-semibold hover:bg-slate-50`}
                  >
                    Call store
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {settings.show_loyalty_banner && (
          <section className="mt-10">
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
                    Save this product and earn rewards when you shop.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                    Use wishlist, loyalty, notifications, and order tracking to
                    get a better shopping experience.
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

        <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <InfoPanel title="Store support">
            <div className="space-y-3 text-sm text-slate-600">
              {tenant.contact_email && (
                <InfoLine label="Email" value={tenant.contact_email} />
              )}

              {tenant.support_phone && (
                <InfoLine label="Phone" value={tenant.support_phone} />
              )}

              {tenant.business_address && (
                <InfoLine label="Address" value={tenant.business_address} />
              )}

              {!tenant.contact_email &&
                !tenant.support_phone &&
                !tenant.business_address && (
                  <p>Contact information will appear here when available.</p>
                )}
            </div>
          </InfoPanel>

          <InfoPanel title="Delivery preview">
            {!shippingZones || shippingZones.length === 0 ? (
              <p className="text-sm text-slate-500">
                Delivery fees will be shown at checkout.
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                {shippingZones.map((zone) => (
                  <div
                    key={zone.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3"
                  >
                    <div>
                      <p className="font-medium text-slate-950">{zone.name}</p>
                      {zone.estimated_days && (
                        <p className="text-xs text-slate-500">
                          {zone.estimated_days}
                        </p>
                      )}
                    </div>

                    <span className="font-bold text-slate-950">
                      {formatMoney(currency, Number(zone.fee))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </InfoPanel>

          <InfoPanel title="Store instructions">
            {tenant.pickup_instructions || tenant.payment_instructions ? (
              <div className="space-y-4 text-sm text-slate-600">
                {tenant.pickup_instructions && (
                  <InfoLine label="Pickup" value={tenant.pickup_instructions} />
                )}

                {tenant.payment_instructions && (
                  <InfoLine
                    label="Payment"
                    value={tenant.payment_instructions}
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Pickup and payment instructions will appear here when available.
              </p>
            )}
          </InfoPanel>
        </section>

        {settings.show_reviews_section && (
          <section className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{
                      color: settings.accent_color,
                    }}
                  >
                    Reviews
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-slate-950">
                    Customer reviews
                  </h2>

                  <p className="mt-1 text-slate-500">
                    {reviews?.length || 0} review(s)
                  </p>
                </div>

                {reviews && reviews.length > 0 && (
                  <p className="rounded-2xl bg-yellow-100 px-4 py-2 text-lg font-bold text-yellow-800">
                    ⭐ {averageRating.toFixed(1)}
                  </p>
                )}
              </div>

              {!reviews || reviews.length === 0 ? (
                <div className="rounded-3xl bg-slate-50 p-8 text-center">
                  <p className="text-slate-500">No reviews yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review: any) => (
                    <div
                      key={review.id}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold">
                          {"⭐".repeat(Number(review.rating))}
                        </p>

                        {review.is_verified_purchase && (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                            Verified purchase
                          </span>
                        )}
                      </div>

                      {review.title && (
                        <h3 className="mt-3 font-bold text-slate-950">
                          {review.title}
                        </h3>
                      )}

                      {review.comment && (
                        <p className="mt-2 leading-7 text-slate-600">
                          {review.comment}
                        </p>
                      )}

                      <p className="mt-3 text-xs text-slate-400">
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
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
                    Reviews for this store are moderated. Your review will
                    appear after approval.
                  </div>
                )}

                <ReviewForm productId={product.id} />
              </div>
            ) : (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold">Reviews disabled</h3>
                <p className="mt-2 text-slate-500">
                  This store is not accepting product reviews right now.
                </p>
              </div>
            )}
          </section>
        )}

        <section className="mt-12 pb-20">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p
                className="text-sm font-semibold uppercase tracking-wide"
                style={{
                  color: settings.accent_color,
                }}
              >
                More to explore
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                Related products
              </h2>
            </div>

            {category && (
              <a
                href={`/store/${tenant.slug}/categories/${category.slug}`}
                className="text-sm font-medium text-slate-500 hover:text-slate-950"
              >
                View more in {category.name} →
              </a>
            )}
          </div>

          {!relatedProducts || relatedProducts.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
              No related products found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((item: any) => {
                const relatedCategory = Array.isArray(item.category)
                  ? item.category[0]
                  : item.category;

                const lowestPrice = getRelatedLowestPrice(item);

                return (
                  <a
                    key={item.id}
                    href={`/store/${tenant.slug}/products/${item.id}`}
                    className={getRelatedProductCardClass(
                      settings.product_card_style
                    )}
                  >
                    <div className="aspect-square overflow-hidden bg-slate-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          No Image
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      {relatedCategory && (
                        <span className="mb-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          {relatedCategory.name}
                        </span>
                      )}

                      <h3 className="text-lg font-bold text-slate-950">
                        {item.name}
                      </h3>

                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                        {item.description ||
                          "Explore this product and available options."}
                      </p>

                      <div className="mt-5 flex items-center justify-between">
                        <p className="text-xl font-bold text-slate-950">
                          {formatMoney(currency, lowestPrice)}
                        </p>

                        <span
                          className="text-sm font-medium"
                          style={{
                            color: settings.accent_color,
                          }}
                        >
                          View
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
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
              href={siteUrl}
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
            <p className="text-xs text-slate-500">Product details</p>
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

function InfoPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-5 text-xl font-bold text-slate-950">{title}</h3>
      {children}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 leading-6 text-slate-700">{value}</p>
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

function getRelatedProductCardClass(productCardStyle: string) {
  if (productCardStyle === "minimal") {
    return "group overflow-hidden border-b border-slate-200 bg-white transition hover:bg-slate-50";
  }

  if (productCardStyle === "bordered") {
    return "group overflow-hidden rounded-3xl border-2 border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl";
  }

  if (productCardStyle === "image_focus") {
    return "group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl";
  }

  return "group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl";
}