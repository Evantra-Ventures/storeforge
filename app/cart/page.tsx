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
  currency: string | null;
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

export default function CartPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const slug = params.slug as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
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
        router.push("/login");
        return;
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("id,name,slug,logo_url,currency")
        .eq("slug", slug)
        .single();

      if (tenantError || !tenantData) {
        setErrorMessage("Store not found.");
        return;
      }

      setTenant(tenantData);

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading cart...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold">Store not found</h1>
          <p className="text-slate-500 mt-2">
            This cart page could not find the store.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
              <p className="text-xs text-slate-500">Shopping Cart</p>
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

            <CustomerNotificationBell tenantId={tenant.id} />

            <a
              href={`/store/${tenant.slug}`}
              className="bg-black text-white px-4 py-2 rounded-xl text-sm hover:opacity-90"
            >
              Continue Shopping
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-bold">Shopping Cart</h1>
            <p className="text-slate-500 mt-2">
              Review your selected products before checkout.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            {totalItems} item(s) in cart
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6">
            {errorMessage}
          </div>
        )}

        {items.length === 0 ? (
          <div className="bg-white rounded-3xl border p-20 text-center">
            <h2 className="text-2xl font-bold">Your cart is empty</h2>
            <p className="text-slate-500 mt-3">
              Add products to your cart before checkout.
            </p>

            <a
              href={`/store/${tenant.slug}`}
              className="inline-block bg-black text-white px-6 py-3 rounded-xl mt-6"
            >
              Back to Store
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-2 space-y-5">
              {items.map((item) => {
                const itemPrice = getItemPrice(item);
                const itemInventory = getItemInventory(item);
                const imageUrl = getItemImage(item);
                const isUpdating = updatingItemId === item.id;
                const isOutOfStock = itemInventory <= 0;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border p-5 flex flex-col md:flex-row gap-5"
                  >
                    <a
                      href={`/store/${tenant.slug}/products/${item.product.id}`}
                      className="w-full md:w-36 h-36 rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-slate-400 text-sm">
                          No Image
                        </span>
                      )}
                    </a>

                    <div className="flex-1">
                      <a
                        href={`/store/${tenant.slug}/products/${item.product.id}`}
                        className="text-xl font-semibold hover:underline"
                      >
                        {item.product.name}
                      </a>

                      {item.variant && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-purple-700">
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

                      <p className="text-slate-500 mt-3">
                        {money(itemPrice)}
                      </p>

                      <p
                        className={`text-xs mt-1 ${
                          isOutOfStock ? "text-red-600" : "text-slate-400"
                        }`}
                      >
                        {isOutOfStock
                          ? "Out of stock"
                          : `Stock available: ${itemInventory}`}
                      </p>

                      <div className="flex items-center gap-3 mt-6">
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          disabled={isUpdating}
                          className="w-10 h-10 rounded-xl border hover:bg-slate-100 disabled:opacity-50"
                        >
                          -
                        </button>

                        <div className="w-12 text-center font-medium">
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
                          className="w-10 h-10 rounded-xl border hover:bg-slate-100 disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={isUpdating}
                        className="mt-6 text-red-500 text-sm hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="md:text-right">
                      <p className="text-2xl font-bold">
                        {money(itemPrice * item.quantity)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </section>

            <aside className="bg-white rounded-3xl border p-6 h-fit lg:sticky lg:top-28">
              <h2 className="text-2xl font-bold mb-8">Order Summary</h2>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Items</span>
                  <span>{totalItems}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Shipping</span>
                  <span className="text-slate-500">
                    Calculated at checkout
                  </span>
                </div>
              </div>

              <div className="border-t my-6" />

              <div className="flex justify-between text-xl font-bold">
                <span>Estimated Total</span>
                <span>{money(subtotal)}</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={items.length === 0}
                className="w-full bg-black text-white py-4 rounded-2xl mt-8 font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                Continue to Checkout
              </button>

              <p className="text-xs text-slate-500 text-center mt-4">
                Delivery, saved address, loyalty points, and payment are handled
                on the checkout page.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}