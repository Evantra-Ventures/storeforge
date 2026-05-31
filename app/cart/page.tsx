"use client";

import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  currency: string | null;
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

type CartItem = {
  id: string;
  quantity: number;
  variant_id: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image_url: string | null;
    inventory: number;
  };
  variant: {
    id: string;
    name: string;
    option_name: string;
    option_value: string;
    price_adjustment: number;
    image_url: string | null;
    inventory: number;
    sku: string | null;
  } | null;
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

export default function CartPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const slug = params.slug as string;
  const cartRedirect = `/store/${slug}/cart`;
  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(cartRedirect)}`;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [storefrontSettings, setStorefrontSettings] =
    useState<StorefrontSettings>(defaultStorefrontSettings);

  const [cartId, setCartId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const currency = tenant?.currency || "GHS";

  const money = (amount: number) =>
    `${currency} ${Number(amount || 0).toFixed(2)}`;

  const getItemPrice = (item: CartItem) =>
    Number(item.product.price) + Number(item.variant?.price_adjustment || 0);

  const getItemInventory = (item: CartItem) =>
    item.variant
      ? Number(item.variant.inventory || 0)
      : Number(item.product.inventory || 0);

  const getItemImage = (item: CartItem) =>
    item.variant?.image_url || item.product.image_url;

  const fetchCart = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(loginRedirectUrl);
        return;
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("id,name,slug,logo_url,banner_url,currency")
        .eq("slug", slug)
        .single();

      if (tenantError || !tenantData) {
        setErrorMessage("Store not found.");
        return;
      }

      setTenant(tenantData);

      await supabase.rpc("ensure_storefront_settings", {
        p_tenant_id: tenantData.id,
      });

      const { data: settingsData } = await supabase
        .from("storefront_settings")
        .select("*")
        .eq("tenant_id", tenantData.id)
        .eq("status", "active")
        .maybeSingle();

      setStorefrontSettings({
        ...defaultStorefrontSettings,
        ...(settingsData || {}),
      });

      const { data: cart, error: cartError } = await supabase
        .from("carts")
        .select("*")
        .eq("tenant_id", tenantData.id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (cartError) {
        setErrorMessage(cartError.message);
        return;
      }

      if (!cart) {
        setCartId(null);
        setItems([]);
        return;
      }

      setCartId(cart.id);

      const { data, error } = await supabase
        .from("cart_items")
        .select(`
          id,
          quantity,
          variant_id,
          product:products (
            id,
            name,
            slug,
            price,
            image_url,
            inventory
          ),
          variant:product_variants (
            id,
            name,
            option_name,
            option_value,
            price_adjustment,
            image_url,
            inventory,
            sku
          )
        `)
        .eq("cart_id", cart.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const formattedItems: CartItem[] = (data || []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        variant_id: item.variant_id || null,
        product: Array.isArray(item.product) ? item.product[0] : item.product,
        variant: item.variant
          ? Array.isArray(item.variant)
            ? item.variant[0]
            : item.variant
          : null,
      }));

      setItems(formattedItems.filter((item) => item.product));
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load cart.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const subtotal = useMemo(() => {
    return items.reduce((acc, item) => {
      return acc + getItemPrice(item) * Number(item.quantity || 0);
    }, 0);
  }, [items]);

  const totalItems = useMemo(() => {
    return items.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
  }, [items]);

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    try {
      setUpdatingItemId(itemId);
      setErrorMessage("");

      const item = items.find((cartItem) => cartItem.id === itemId);

      if (!item) return;

      if (quantity > getItemInventory(item)) {
        setErrorMessage("You cannot add more than available stock.");
        return;
      }

      const { error } = await supabase
        .from("cart_items")
        .update({
          quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
      );
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update quantity.");
    } finally {
      setUpdatingItemId(null);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      setUpdatingItemId(itemId);
      setErrorMessage("");

      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to remove item.");
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleCheckout = () => {
    if (!tenant) return;

    if (!cartId || items.length === 0) {
      setErrorMessage("Your cart is empty.");
      return;
    }

    for (const item of items) {
      if (item.quantity > getItemInventory(item)) {
        setErrorMessage(`${item.product.name} does not have enough stock.`);
        return;
      }
    }

    router.push(`/store/${tenant.slug}/checkout`);
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          backgroundColor: storefrontSettings.background_color,
          color: storefrontSettings.text_color,
        }}
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-slate-500">Loading cart...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 bg-slate-50">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Store not found</h1>
          <p className="mt-2 text-slate-500">
            This cart page could not find the store.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: storefrontSettings.background_color,
        color: storefrontSettings.text_color,
      }}
    >
      <CartHeader tenant={tenant} settings={storefrontSettings} />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section
          className="relative mb-10 overflow-hidden rounded-[2rem] p-8 text-white shadow-sm"
          style={{
            backgroundColor: storefrontSettings.primary_color,
          }}
        >
          <div
            className="absolute inset-0 opacity-70"
            style={{
              background: `radial-gradient(circle at top right, ${storefrontSettings.accent_color}55, transparent 35%), radial-gradient(circle at top left, rgba(168,85,247,0.22), transparent 35%)`,
            }}
          />

          {(storefrontSettings.hero_image_url || tenant.banner_url) && (
            <img
              src={storefrontSettings.hero_image_url || tenant.banner_url || ""}
              alt={`${tenant.name} cart banner`}
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
          )}

          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
                Secure shopping cart
              </div>

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Shopping Cart
              </h1>

              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                Review your selected products, update quantities, and continue
                to checkout when everything looks right.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm text-slate-300">Cart summary</p>
              <p className="mt-2 text-3xl font-bold">{totalItems}</p>
              <p className="text-sm text-slate-300">item(s) selected</p>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-20 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
              🛒
            </div>

            <h2 className="text-2xl font-bold text-slate-950">
              Your cart is empty
            </h2>

            <p className="mt-3 text-slate-500">
              Add products to your cart before checkout.
            </p>

            <a
              href={`/store/${tenant.slug}`}
              className={`${getButtonClass(
                storefrontSettings.button_style
              )} mt-6 inline-block px-6 py-3 font-semibold text-white`}
              style={{
                backgroundColor: storefrontSettings.primary_color,
              }}
            >
              Back to Store
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <section className="space-y-5 lg:col-span-2">
              {items.map((item) => {
                const itemPrice = getItemPrice(item);
                const itemInventory = getItemInventory(item);
                const imageUrl = getItemImage(item);
                const isUpdating = updatingItemId === item.id;
                const isOutOfStock = itemInventory <= 0;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg md:flex-row"
                  >
                    <a
                      href={`/store/${tenant.slug}/products/${item.product.id}`}
                      className="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-100 md:h-36 md:w-36"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm text-slate-400">
                          No Image
                        </span>
                      )}
                    </a>

                    <div className="flex-1">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <a
                            href={`/store/${tenant.slug}/products/${item.product.id}`}
                            className="text-xl font-semibold text-slate-950 hover:underline"
                          >
                            {item.product.name}
                          </a>

                          {item.variant && (
                            <div className="mt-2 space-y-1">
                              <p
                                className="text-sm font-medium"
                                style={{
                                  color: storefrontSettings.accent_color,
                                }}
                              >
                                {item.variant.option_name}:{" "}
                                {item.variant.option_value}
                              </p>

                              {item.variant.sku && (
                                <p className="text-xs text-slate-400">
                                  SKU: {item.variant.sku}
                                </p>
                              )}
                            </div>
                          )}

                          <p className="mt-3 text-slate-500">
                            {money(itemPrice)}
                          </p>

                          <p
                            className={`mt-1 text-xs ${isOutOfStock
                                ? "text-red-600"
                                : "text-slate-400"
                              }`}
                          >
                            {isOutOfStock
                              ? "Out of stock"
                              : `Stock available: ${itemInventory}`}
                          </p>
                        </div>

                        <div className="md:text-right">
                          <p className="text-2xl font-bold text-slate-950">
                            {money(itemPrice * item.quantity)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          disabled={isUpdating}
                          className="h-10 w-10 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                        >
                          -
                        </button>

                        <div className="w-12 text-center font-medium text-slate-950">
                          {item.quantity}
                        </div>

                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          disabled={
                            isUpdating ||
                            item.quantity >= itemInventory ||
                            isOutOfStock
                          }
                          className="h-10 w-10 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-50"
                        >
                          +
                        </button>

                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={isUpdating}
                          className="ml-auto text-sm text-red-500 hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
              <div className="mb-8">
                <p
                  className="text-sm font-semibold uppercase tracking-wide"
                  style={{
                    color: storefrontSettings.accent_color,
                  }}
                >
                  Order summary
                </p>

                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  Cart total
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Shipping, saved address, loyalty points, and payment are
                  handled on the checkout page.
                </p>
              </div>

              <div className="space-y-4">
                <SummaryRow label="Items" value={String(totalItems)} />
                <SummaryRow label="Subtotal" value={money(subtotal)} />
                <SummaryRow label="Shipping" value="Calculated at checkout" />
              </div>

              <div className="my-6 border-t border-slate-200" />

              <div className="flex justify-between text-xl font-bold text-slate-950">
                <span>Estimated Total</span>
                <span>{money(subtotal)}</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={items.length === 0}
                className={`${getButtonClass(
                  storefrontSettings.button_style
                )} mt-8 w-full py-4 font-semibold text-white transition hover:opacity-90 disabled:opacity-50`}
                style={{
                  backgroundColor: storefrontSettings.accent_color,
                }}
              >
                Continue to Checkout
              </button>

              <a
                href={`/store/${tenant.slug}`}
                className={`${getButtonClass(
                  storefrontSettings.button_style
                )} mt-3 block w-full border border-slate-200 py-4 text-center font-semibold text-slate-700 hover:bg-slate-50`}
              >
                Continue Shopping
              </a>

              {storefrontSettings.show_loyalty_banner && (
                <div
                  className="mt-6 rounded-2xl border p-4"
                  style={{
                    borderColor: `${storefrontSettings.accent_color}33`,
                    backgroundColor: `${storefrontSettings.accent_color}10`,
                  }}
                >
                  <p
                    className="font-semibold"
                    style={{
                      color: storefrontSettings.primary_color,
                    }}
                  >
                    Rewards ready
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Continue to checkout to apply available loyalty points and
                    complete your order.
                  </p>

                  <a
                    href="/customer/loyalty"
                    className="mt-3 inline-block text-sm font-medium hover:underline"
                    style={{
                      color: storefrontSettings.accent_color,
                    }}
                  >
                    View rewards →
                  </a>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function CartHeader({
  tenant,
  settings,
}: {
  tenant: Tenant;
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
              {tenant.name.slice(0, 1)}
            </div>
          )}

          <div>
            <p className="text-xl font-bold text-slate-950">{tenant.name}</p>
            <p className="text-xs text-slate-500">Shopping cart</p>
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
            href={`/store/${tenant.slug}`}
            className={`${getButtonClass(
              settings.button_style
            )} px-4 py-2 text-sm font-medium text-white`}
            style={{
              backgroundColor: settings.primary_color,
            }}
          >
            Continue Shopping
          </a>
        </div>
      </div>
    </header>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-950">{value}</span>
    </div>
  );
}