"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CustomerProfile = {
  id: string;
  tenant_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  marketing_email_opt_in: boolean;
  marketing_sms_opt_in: boolean;
  marketing_whatsapp_opt_in: boolean;
  default_address_id: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  status: string;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

type CustomerAddress = {
  id: string;
  label: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  area: string | null;
  city: string | null;
  region: string | null;
  country: string;
  postal_code: string | null;
  delivery_instructions: string | null;
  is_default: boolean;
  status: string;
  created_at: string;
};

type Order = {
  id: string;
  total_amount: number;
  subtotal_amount: number | null;
  discount_amount: number | null;
  shipping_fee: number | null;
  refunded_amount: number | null;
  status: string | null;
  payment_status: string | null;
  delivery_method: string | null;
  delivery_status: string | null;
  coupon_code: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  quantity: number;
  price: number;
  product_id: string | null;
  variant_id: string | null;
  product:
    | {
        id: string;
        name: string;
        image_url: string | null;
      }
    | {
        id: string;
        name: string;
        image_url: string | null;
      }[]
    | null;
  variant:
    | {
        id: string;
        name: string;
        option_name: string;
        option_value: string;
        sku: string | null;
        image_url: string | null;
      }
    | {
        id: string;
        name: string;
        option_name: string;
        option_value: string;
        sku: string | null;
        image_url: string | null;
      }[]
    | null;
};

type Review = {
  id: string;
  product_id: string;
  rating: number;
  status: string;
  title: string | null;
  body: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  product:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type WishlistItem = {
  id: string;
  product_id: string;
  created_at: string;
  product:
    | {
        id: string;
        name: string;
        image_url: string | null;
        price: number;
      }
    | {
        id: string;
        name: string;
        image_url: string | null;
        price: number;
      }[]
    | null;
};

export default function CustomerDetailPage() {
  const supabase = createClient();
  const params = useParams();

  const customerId = params.customerId as string;

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [status, setStatus] = useState("active");
  const [internalNote, setInternalNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const money = (value: number) => `GHS ${Number(value || 0).toFixed(2)}`;

  const formatStatus = (value: string | null | undefined) =>
    (value || "pending").replaceAll("_", " ");

  const getOrderItemProduct = (item: OrderItem) => {
  if (!item.product) return null;
  return Array.isArray(item.product) ? item.product[0] : item.product;
};

const getReviewProduct = (review: Review) => {
  if (!review.product) return null;
  return Array.isArray(review.product) ? review.product[0] : review.product;
};

const getWishlistProduct = (item: WishlistItem) => {
  if (!item.product) return null;
  return Array.isArray(item.product) ? item.product[0] : item.product;
};

  const getVariant = (item: OrderItem) => {
    if (!item.variant) return null;
    return Array.isArray(item.variant) ? item.variant[0] : item.variant;
  };

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      const { data: staffProfile, error: staffProfileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (staffProfileError || !staffProfile?.tenant_id) {
        setErrorMessage("Tenant profile not found.");
        return;
      }

      setTenantId(staffProfile.tenant_id);

      const { data: customerData, error: customerError } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("id", customerId)
        .eq("tenant_id", staffProfile.tenant_id)
        .single();

      if (customerError || !customerData) {
        setErrorMessage("Customer not found.");
        return;
      }

      setCustomer(customerData);
      setStatus(customerData.status || "active");
      setInternalNote(customerData.metadata?.internal_note || "");

      const { data: addressData } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("tenant_id", staffProfile.tenant_id)
        .eq("customer_profile_id", customerData.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      setAddresses(addressData || []);

      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          id,
          total_amount,
          subtotal_amount,
          discount_amount,
          shipping_fee,
          refunded_amount,
          status,
          payment_status,
          delivery_method,
          delivery_status,
          coupon_code,
          created_at
        `)
        .eq("tenant_id", staffProfile.tenant_id)
        .eq("customer_id", customerData.user_id)
        .order("created_at", { ascending: false });

      const loadedOrders = ordersData || [];
      setOrders(loadedOrders);

      const orderIds = loadedOrders.map((order) => order.id);

      if (orderIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("order_items")
          .select(`
            id,
            order_id,
            quantity,
            price,
            product_id,
            variant_id,
            product:products (
              id,
              name,
              image_url
            ),
            variant:product_variants (
              id,
              name,
              option_name,
              option_value,
              sku,
              image_url
            )
          `)
          .in("order_id", orderIds);

        setOrderItems(itemsData || []);
      } else {
        setOrderItems([]);
      }

      const { data: reviewsData } = await supabase
        .from("product_reviews")
        .select(`
          id,
          product_id,
          rating,
          status,
          title,
          body,
          is_verified_purchase,
          created_at,
          product:products (
            id,
            name
          )
        `)
        .eq("tenant_id", staffProfile.tenant_id)
        .eq("user_id", customerData.user_id)
        .order("created_at", { ascending: false });

      setReviews(reviewsData || []);

      const { data: wishlistData } = await supabase
  .from("wishlists")
  .select(`
    id,
    product_id,
    created_at,
    product:products (
      id,
      name,
      image_url,
      price
    )
  `)
  .eq("tenant_id", staffProfile.tenant_id)
  .eq("user_id", customerData.user_id)
  .order("created_at", { ascending: false });

      setWishlistItems(wishlistData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load customer detail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const stats = useMemo(() => {
    const paidOrders = orders.filter((order) => order.payment_status === "paid");

    const totalPaid = paidOrders.reduce(
      (acc, order) => acc + Number(order.total_amount || 0),
      0
    );

    const totalRefunded = orders.reduce(
      (acc, order) => acc + Number(order.refunded_amount || 0),
      0
    );

    const totalItems = orderItems.reduce(
      (acc, item) => acc + Number(item.quantity || 0),
      0
    );

    return {
      paidOrders: paidOrders.length,
      pendingOrders: orders.filter((order) => order.payment_status === "pending")
        .length,
      cancelledOrders: orders.filter((order) => order.status === "cancelled")
        .length,
      totalPaid,
      totalRefunded,
      totalItems,
      averageOrderValue:
        paidOrders.length > 0 ? totalPaid / paidOrders.length : 0,
      reviews: reviews.length,
      wishlistItems: wishlistItems.length,
      addresses: addresses.length,
    };
  }, [orders, orderItems, reviews, wishlistItems, addresses]);

  const topPurchasedProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>();

    orderItems.forEach((item) => {
      const product = getOrderItemProduct(item);
      const key = item.product_id || item.id;

      const existing = map.get(key) || {
        name: product?.name || "Deleted product",
        quantity: 0,
        revenue: 0,
      };

      existing.quantity += Number(item.quantity || 0);
      existing.revenue += Number(item.price || 0) * Number(item.quantity || 0);

      map.set(key, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orderItems]);

  const handleUpdateStatus = async () => {
    if (!customer || !tenantId) return;

    try {
      setSavingStatus(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("customer_profiles")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customer.id)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Customer status updated.");
      fetchCustomerDetail();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update customer status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveNote = async () => {
    if (!customer || !tenantId) return;

    try {
      setSavingNote(true);
      setErrorMessage("");
      setSuccessMessage("");

      const nextMetadata = {
        ...(customer.metadata || {}),
        internal_note: internalNote,
        internal_note_updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("customer_profiles")
        .update({
          metadata: nextMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customer.id)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Customer note saved.");
      fetchCustomerDetail();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to save customer note.");
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return <p className="text-slate-500">Loading customer detail...</p>;
  }

  if (!customer) {
    return (
      <div className="bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold">Customer not found</h1>
        <p className="text-slate-500 mt-2">
          This customer does not exist or does not belong to your tenant.
        </p>

        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl mt-6">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <a href="/customers" className="text-sm text-slate-500 hover:text-black">
          ← Back to Customers
        </a>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mt-4">
          <div>
            <h1 className="text-3xl font-bold">
              {customer.full_name || "Unnamed Customer"}
            </h1>
            <p className="text-slate-500 mt-2">
              Customer profile, orders, addresses, reviews, and wishlist
              activity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs capitalize ${
                customer.status === "active"
                  ? "bg-green-100 text-green-700"
                  : customer.status === "blocked"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {customer.status}
            </span>

            {Number(customer.total_orders || 0) > 1 && (
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                Repeat Customer
              </span>
            )}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-100 text-red-700 p-4 rounded-xl">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 text-green-700 p-4 rounded-xl">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Total Spent" value={money(Number(customer.total_spent || 0))} />
        <StatCard label="Total Orders" value={customer.total_orders || 0} />
        <StatCard label="Avg. Order Value" value={money(stats.averageOrderValue)} />
        <StatCard label="Items Purchased" value={stats.totalItems} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Paid Orders" value={stats.paidOrders} />
        <StatCard label="Pending Orders" value={stats.pendingOrders} />
        <StatCard label="Refunded" value={money(stats.totalRefunded)} />
        <StatCard label="Saved Addresses" value={stats.addresses} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white rounded-2xl shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-6">Customer Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <Info label="Full Name" value={customer.full_name || "Not provided"} />
            <Info label="Email" value={customer.email || "Not provided"} />
            <Info label="Phone" value={customer.phone || "Not provided"} />
            <Info
              label="Date of Birth"
              value={
                customer.date_of_birth
                  ? new Date(customer.date_of_birth).toLocaleDateString()
                  : "Not provided"
              }
            />
            <Info
              label="Joined"
              value={new Date(customer.created_at).toLocaleDateString()}
            />
            <Info
              label="Last Order"
              value={
                customer.last_order_at
                  ? new Date(customer.last_order_at).toLocaleDateString()
                  : "No order yet"
              }
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            {customer.marketing_email_opt_in && (
              <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs">
                Email Opt-in
              </span>
            )}

            {customer.marketing_sms_opt_in && (
              <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                SMS Opt-in
              </span>
            )}

            {customer.marketing_whatsapp_opt_in && (
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                WhatsApp Opt-in
              </span>
            )}

            {!customer.marketing_email_opt_in &&
              !customer.marketing_sms_opt_in &&
              !customer.marketing_whatsapp_opt_in && (
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                  No marketing opt-in
                </span>
              )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Customer Controls</h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage customer status and private staff notes.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Status</label>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border rounded-xl p-3"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </select>

            <button
              onClick={handleUpdateStatus}
              disabled={savingStatus}
              className="w-full bg-black text-white py-3 rounded-xl mt-3 disabled:opacity-50"
            >
              {savingStatus ? "Saving..." : "Update Status"}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Internal Note
            </label>

            <textarea
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Private note for your team..."
              className="w-full border rounded-xl p-3 min-h-[120px]"
            />

            <button
              onClick={handleSaveNote}
              disabled={savingNote}
              className="w-full border py-3 rounded-xl mt-3 hover:bg-slate-100 disabled:opacity-50"
            >
              {savingNote ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      </div>

      <Panel title="Saved Addresses">
        {addresses.length === 0 ? (
          <p className="text-slate-500">No saved addresses.</p>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div key={address.id} className="border rounded-2xl p-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                    {address.label}
                  </span>

                  {address.is_default && (
                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                      Default
                    </span>
                  )}

                  <span
                    className={`px-3 py-1 rounded-full text-xs ${
                      address.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {address.status}
                  </span>
                </div>

                <h3 className="font-semibold mt-3">
                  {address.full_name || customer.full_name || "Recipient"}
                </h3>

                <p className="text-sm text-slate-500 mt-1">
                  {address.phone || customer.phone || "No phone"}
                </p>

                <p className="text-sm text-slate-700 mt-3">
                  {[
                    address.address_line1,
                    address.address_line2,
                    address.area,
                    address.city,
                    address.region,
                    address.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>

                {address.delivery_instructions && (
                  <p className="text-sm text-slate-500 mt-2">
                    Note: {address.delivery_instructions}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Top Purchased Products">
          {topPurchasedProducts.length === 0 ? (
            <p className="text-slate-500">No purchases yet.</p>
          ) : (
            <div className="space-y-4">
              {topPurchasedProducts.map((product) => (
                <div
                  key={product.name}
                  className="border rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-slate-500">
                      {product.quantity} item(s)
                    </p>
                  </div>

                  <p className="font-bold">{money(product.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Wishlist Activity">
          {wishlistItems.length === 0 ? (
            <p className="text-slate-500">No wishlist activity.</p>
          ) : (
            <div className="space-y-4">
              {wishlistItems.slice(0, 8).map((item) => {
                const product = getWishlistProduct(item);

                return (
                  <div
                    key={item.id}
                    className="border rounded-2xl p-4 flex items-center gap-4"
                  >
                    <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden">
                      {product?.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {product?.name || "Deleted product"}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {product ? money(Number(product.price || 0)) : ""}
                      </p>
                    </div>

                    <p className="text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Order History">
        {orders.length === 0 ? (
          <p className="text-slate-500">No orders yet.</p>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => {
              const items = orderItems.filter(
                (item) => item.order_id === order.id
              );

              return (
                <div key={order.id} className="border rounded-2xl p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                          #{order.id.slice(0, 8)}
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full text-xs capitalize ${
                            order.payment_status === "paid"
                              ? "bg-green-100 text-green-700"
                              : order.payment_status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {formatStatus(order.payment_status)}
                        </span>

                        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs capitalize">
                          {formatStatus(order.status)}
                        </span>
                      </div>

                      <p className="text-sm text-slate-500 mt-3">
                        {new Date(order.created_at).toLocaleString()}
                      </p>

                      <p className="text-sm text-slate-500 mt-1">
                        {items.length} item(s)
                        {order.coupon_code ? ` · Coupon: ${order.coupon_code}` : ""}
                      </p>
                    </div>

                    <div className="lg:text-right">
                      <p className="text-2xl font-bold">
                        {money(Number(order.total_amount || 0))}
                      </p>

                      <a
                        href={`/dashboard/orders/${order.id}`}
                        className="inline-block border px-4 py-2 rounded-xl text-sm mt-3 hover:bg-slate-100"
                      >
                        View Order
                      </a>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="mt-5 space-y-3">
                      {items.slice(0, 4).map((item) => {
                        const product = getOrderItemProduct(item);
                        const variant = getVariant(item);
                        const imageUrl = variant?.image_url || product?.image_url;

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3"
                          >
                            <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product?.name || "Product"}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>

                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {product?.name || "Deleted product"}
                              </p>

                              {variant && (
                                <p className="text-xs text-purple-700">
                                  {variant.option_name}: {variant.option_value}
                                </p>
                              )}

                              <p className="text-xs text-slate-500">
                                Qty {item.quantity} × {money(Number(item.price))}
                              </p>
                            </div>

                            <p className="font-semibold text-sm">
                              {money(
                                Number(item.price || 0) *
                                  Number(item.quantity || 0)
                              )}
                            </p>
                          </div>
                        );
                      })}

                      {items.length > 4 && (
                        <p className="text-xs text-slate-500">
                          +{items.length - 4} more item(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Reviews">
        {reviews.length === 0 ? (
          <p className="text-slate-500">No reviews from this customer.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const product = getReviewProduct(review);

              return (
                <div key={review.id} className="border rounded-2xl p-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                      ⭐ {review.rating}
                    </span>

                    <span
                      className={`px-3 py-1 rounded-full text-xs capitalize ${
                        review.status === "published"
                          ? "bg-green-100 text-green-700"
                          : review.status === "hidden"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {review.status}
                    </span>

                    {review.is_verified_purchase && (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                        Verified Purchase
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold mt-3">
                    {review.title || "Untitled review"}
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Product: {product?.name || "Deleted product"}
                  </p>

                  {review.body && (
                    <p className="text-sm text-slate-700 mt-3">
                      {review.body}
                    </p>
                  )}

                  <p className="text-xs text-slate-400 mt-3">
                    {new Date(review.created_at).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
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
    <div className="bg-white rounded-2xl shadow p-6">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="text-3xl font-bold mt-2">{value}</h2>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-xl font-semibold mb-6">{title}</h2>
      {children}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border rounded-2xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold mt-1">{value}</p>
    </div>
  );
}