"use client";

import { useEffect, useMemo, useState } from "react";
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
  hero_image_url: string | null;
  button_style: string;
  status: string;
};

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
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
  variant:
    | {
        id: string;
        name: string;
        option_name: string;
        option_value: string;
        sku: string | null;
      }
    | {
        id: string;
        name: string;
        option_name: string;
        option_value: string;
        sku: string | null;
      }[]
    | null;
};

type Order = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  subtotal_amount: number | null;
  discount_amount: number | null;
  coupon_code: string | null;
  refunded_amount: number | null;
  refund_status: string | null;
  total_amount: number;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
  delivery_status: string | null;
  delivery_method: string | null;
  shipping_area: string | null;
  shipping_city: string | null;
  shipping_region: string | null;
  created_at: string;
  order_items?: OrderItem[];
};

const defaultStorefrontSettings: StorefrontSettings = {
  id: "default",
  tenant_id: "default",
  theme_preset: "modern_dark",
  primary_color: "#020617",
  accent_color: "#2563eb",
  background_color: "#f8fafc",
  text_color: "#0f172a",
  hero_image_url: null,
  button_style: "rounded",
  status: "active",
};

function money(amount: number, currency = "GHS") {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function formatStatus(value: string | null | undefined) {
  return (value || "pending").replaceAll("_", " ");
}

function getButtonClass(buttonStyle: string) {
  if (buttonStyle === "pill") return "rounded-full";
  if (buttonStyle === "sharp") return "rounded-none";
  if (buttonStyle === "soft") return "rounded-xl";
  return "rounded-2xl";
}

function getStatusBadgeClass(status: string | null | undefined) {
  const value = status || "pending";

  if (["paid", "completed", "delivered"].includes(value)) {
    return "bg-green-100 text-green-700";
  }

  if (["processing", "preparing", "out_for_delivery"].includes(value)) {
    return "bg-blue-100 text-blue-700";
  }

  if (["failed", "cancelled", "returned", "full"].includes(value)) {
    return "bg-red-100 text-red-700";
  }

  if (["refunded", "partial"].includes(value)) {
    return "bg-purple-100 text-purple-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

export default function OrdersPage() {
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [storefrontSettings, setStorefrontSettings] =
    useState<StorefrontSettings>(defaultStorefrontSettings);

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [refundFilter, setRefundFilter] = useState("");

  const currency = tenant?.currency || "GHS";

  const getProduct = (item: OrderItem) =>
    Array.isArray(item.product) ? item.product[0] : item.product;

  const getVariant = (item: OrderItem) =>
    Array.isArray(item.variant) ? item.variant[0] : item.variant;

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const query = searchTerm.toLowerCase().trim();

      const matchesSearch =
        !query ||
        order.id.toLowerCase().includes(query) ||
        (order.customer_name || "").toLowerCase().includes(query) ||
        (order.customer_email || "").toLowerCase().includes(query) ||
        (order.shipping_city || "").toLowerCase().includes(query) ||
        (order.shipping_area || "").toLowerCase().includes(query);

      const matchesStatus =
        !statusFilter || (order.status || "pending") === statusFilter;

      const matchesPayment =
        !paymentFilter ||
        (order.payment_status || "pending") === paymentFilter;

      const matchesDelivery =
        !deliveryFilter ||
        (order.delivery_status || "pending") === deliveryFilter;

      const matchesRefund =
        !refundFilter ||
        (order.refund_status || "none") === refundFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesDelivery &&
        matchesRefund
      );
    });
  }, [orders, searchTerm, statusFilter, paymentFilter, deliveryFilter, refundFilter]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;

    const paidOrders = orders.filter(
      (order) => order.payment_status === "paid"
    ).length;

    const pendingOrders = orders.filter(
      (order) => (order.status || "pending") === "pending"
    ).length;

    const processingOrders = orders.filter(
      (order) => (order.status || "pending") === "processing"
    ).length;

    const completedOrders = orders.filter(
      (order) => (order.status || "pending") === "completed"
    ).length;

    const activeDeliveries = orders.filter((order) =>
      ["pending", "preparing", "out_for_delivery"].includes(
        order.delivery_status || "pending"
      )
    ).length;

    const failedPayments = orders.filter(
      (order) => order.payment_status === "failed"
    ).length;

    const refundedOrders = orders.filter(
      (order) => (order.refund_status || "none") !== "none"
    ).length;

    const revenue = orders
      .filter((order) => order.payment_status === "paid")
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    return {
      totalOrders,
      paidOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      activeDeliveries,
      failedPayments,
      refundedOrders,
      revenue,
    };
  }, [orders]);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setPaymentFilter("");
    setDeliveryFilter("");
    setRefundFilter("");
  };

  const fetchOrders = async () => {
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setErrorMessage(profileError?.message || "Tenant profile not found.");
        return;
      }

      setTenantId(profile.tenant_id);

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id,name,slug,logo_url,banner_url,currency")
        .eq("id", profile.tenant_id)
        .single();

      setTenant(tenantData || null);

      await supabase.rpc("ensure_storefront_settings", {
        p_tenant_id: profile.tenant_id,
      });

      const { data: settingsData } = await supabase
        .from("storefront_settings")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active")
        .maybeSingle();

      setStorefrontSettings({
        ...defaultStorefrontSettings,
        ...(settingsData || {}),
      });

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            product:products (
              id,
              name
            ),
            variant:product_variants (
              id,
              name,
              option_name,
              option_value,
              sku
            )
          )
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setOrders((data || []) as Order[]);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!tenantId) return;

    try {
      setUpdatingId(orderId);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("orders")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status } : order
        )
      );

      setSuccessMessage("Order status updated successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const updateDeliveryStatus = async (orderId: string, deliveryStatus: string) => {
    if (!tenantId) return;

    try {
      setUpdatingId(orderId);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("orders")
        .update({
          delivery_status: deliveryStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, delivery_status: deliveryStatus } : order
        )
      );

      setSuccessMessage("Delivery status updated successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update delivery status.");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heroImage =
    storefrontSettings.hero_image_url || tenant?.banner_url || null;

  return (
    <div className="space-y-8">
      <section
        className="relative overflow-hidden rounded-[2rem] p-8 text-white shadow-sm"
        style={{
          backgroundColor: storefrontSettings.primary_color,
        }}
      >
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(circle at top right, ${storefrontSettings.accent_color}55, transparent 35%), radial-gradient(circle at top left, rgba(168,85,247,0.22), transparent 35%)`,
          }}
        />

        {heroImage && (
          <img
            src={heroImage}
            alt={`${tenant?.name || "Store"} orders banner`}
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}

        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
          <div className="lg:col-span-2">
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Merchant order management
            </div>

            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="h-16 w-16 rounded-2xl border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-slate-950">
                  {tenant?.name?.slice(0, 1) || "S"}
                </div>
              )}

              <div>
                <p className="text-sm text-slate-300">Operations center</p>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                  Orders
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              Review customer purchases, update order and delivery progress,
              monitor payments and refunds, and keep fulfillment moving.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/products"
                className={`${getButtonClass(
                  storefrontSettings.button_style
                )} bg-white px-6 py-4 text-center font-semibold`}
                style={{
                  color: storefrontSettings.primary_color,
                }}
              >
                Manage products
              </a>

              <a
                href="/dashboard"
                className={`${getButtonClass(
                  storefrontSettings.button_style
                )} border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10`}
              >
                Dashboard overview
              </a>

              <a
                href={tenant ? `/store/${tenant.slug}` : "/"}
                className={`${getButtonClass(
                  storefrontSettings.button_style
                )} border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10`}
              >
                View storefront
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white p-4 text-slate-950 shadow-2xl">
            <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
              <p className="text-sm text-slate-300">Orders snapshot</p>

              <h2 className="mt-2 text-4xl font-bold">{stats.totalOrders}</h2>
              <p className="mt-1 text-sm text-slate-300">total order(s)</p>

              <div className="mt-6 space-y-3">
                <HeroMiniRow label="Paid orders" value={stats.paidOrders} />
                <HeroMiniRow label="Pending" value={stats.pendingOrders} />
                <HeroMiniRow label="Active deliveries" value={stats.activeDeliveries} />
                <HeroMiniRow label="Paid revenue" value={money(stats.revenue, currency)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {(errorMessage || successMessage) && (
        <div className="space-y-3">
          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
              {successMessage}
            </div>
          )}
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total orders" value={stats.totalOrders} helper="All customer orders" />
        <StatCard label="Paid orders" value={stats.paidOrders} helper="Successful payments" />
        <StatCard label="Pending" value={stats.pendingOrders} helper="Needs attention" danger={stats.pendingOrders > 0} />
        <StatCard label="Deliveries" value={stats.activeDeliveries} helper="In progress" />
        <StatCard label="Revenue" value={money(stats.revenue, currency)} helper="Paid orders" />
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <MiniStat label="Processing" value={stats.processingOrders} tone="blue" />
        <MiniStat label="Completed" value={stats.completedOrders} tone="green" />
        <MiniStat label="Failed payments" value={stats.failedPayments} tone="red" />
        <MiniStat label="Refunded orders" value={stats.refundedOrders} tone="purple" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-wide"
              style={{
                color: storefrontSettings.accent_color,
              }}
            >
              Filters
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Find orders quickly
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Search by order ID, customer, email, city, area, status, payment,
              delivery, or refund status.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={resetFilters}
              className={`${getButtonClass(
                storefrontSettings.button_style
              )} border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50`}
            >
              Reset filters
            </button>

            <button
              onClick={fetchOrders}
              disabled={loading}
              className={`${getButtonClass(
                storefrontSettings.button_style
              )} px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50`}
              style={{
                backgroundColor: storefrontSettings.primary_color,
              }}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search orders..."
            className="field-input md:col-span-2"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="field-input"
          >
            <option value="">All order statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="field-input"
          >
            <option value="">All payments</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          <select
            value={deliveryFilter}
            onChange={(event) => setDeliveryFilter(event.target.value)}
            className="field-input"
          >
            <option value="">All deliveries</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="returned">Returned</option>
          </select>

          <select
            value={refundFilter}
            onChange={(event) => setRefundFilter(event.target.value)}
            className="field-input"
          >
            <option value="">All refunds</option>
            <option value="none">None</option>
            <option value="partial">Partial</option>
            <option value="full">Full</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p
              className="text-sm font-semibold uppercase tracking-wide"
              style={{
                color: storefrontSettings.accent_color,
              }}
            >
              Orders
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Recent orders
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {filteredOrders.length} order(s) match your current view.
            </p>
          </div>
        </div>

        {loading ? (
          <EmptyState text="Loading orders..." />
        ) : filteredOrders.length === 0 ? (
          <EmptyState text="No orders found." />
        ) : (
          <div className="space-y-5">
            {filteredOrders.map((order) => {
              const orderCurrency = order.currency || currency;
              const visibleItems = (order.order_items || []).slice(0, 3);
              const hiddenItemCount = Math.max(
                0,
                Number(order.order_items?.length || 0) - 3
              );

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div
                    className="h-2"
                    style={{
                      backgroundColor: storefrontSettings.accent_color,
                    }}
                  />

                  <div className="p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-3 py-1 text-xs font-medium text-white"
                            style={{
                              backgroundColor: storefrontSettings.primary_color,
                            }}
                          >
                            #{order.id.slice(0, 8)}
                          </span>

                          <StatusBadge
                            label={formatStatus(order.status)}
                            className={getStatusBadgeClass(order.status)}
                          />

                          <StatusBadge
                            label={`Payment: ${formatStatus(order.payment_status)}`}
                            className={getStatusBadgeClass(order.payment_status)}
                          />

                          <StatusBadge
                            label={`Delivery: ${formatStatus(order.delivery_status)}`}
                            className={getStatusBadgeClass(order.delivery_status)}
                          />

                          {order.coupon_code && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                              Coupon: {order.coupon_code}
                            </span>
                          )}

                          {order.refund_status &&
                            order.refund_status !== "none" && (
                              <StatusBadge
                                label={`Refund: ${formatStatus(order.refund_status)}`}
                                className={getStatusBadgeClass(order.refund_status)}
                              />
                            )}
                        </div>

                        <div className="mt-5">
                          <h3 className="text-xl font-bold text-slate-950">
                            {order.customer_name || "Customer"}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {order.customer_email || "No email"}
                          </p>

                          <p className="mt-2 text-xs text-slate-400">
                            Placed{" "}
                            {order.created_at
                              ? new Date(order.created_at).toLocaleString()
                              : "recently"}
                          </p>

                          <p className="mt-2 text-sm capitalize text-slate-500">
                            {order.delivery_method || "delivery"}
                            {order.shipping_area ? ` · ${order.shipping_area}` : ""}
                            {order.shipping_city ? `, ${order.shipping_city}` : ""}
                            {order.shipping_region ? `, ${order.shipping_region}` : ""}
                          </p>
                        </div>
                      </div>

                      <div
                        className="rounded-2xl p-5 xl:min-w-[340px]"
                        style={{
                          backgroundColor: `${storefrontSettings.accent_color}10`,
                        }}
                      >
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-xs text-slate-500">Order total</p>
                            <p className="mt-1 text-3xl font-bold text-slate-950">
                              {money(Number(order.total_amount || 0), orderCurrency)}
                            </p>
                          </div>

                          <a
                            href={`/orders/${order.id}`}
                            className={`${getButtonClass(
                              storefrontSettings.button_style
                            )} px-4 py-2 text-sm font-medium text-white hover:opacity-90`}
                            style={{
                              backgroundColor: storefrontSettings.primary_color,
                            }}
                          >
                            View
                          </a>
                        </div>

                        <div className="mt-4 space-y-2 text-xs">
                          {Number(order.subtotal_amount || 0) > 0 && (
                            <div className="flex justify-between text-slate-500">
                              <span>Subtotal</span>
                              <span>
                                {money(Number(order.subtotal_amount || 0), orderCurrency)}
                              </span>
                            </div>
                          )}

                          {Number(order.discount_amount || 0) > 0 && (
                            <div className="flex justify-between text-green-700">
                              <span>Discount</span>
                              <span>
                                -{money(Number(order.discount_amount || 0), orderCurrency)}
                              </span>
                            </div>
                          )}

                          {Number(order.refunded_amount || 0) > 0 && (
                            <div className="flex justify-between text-purple-700">
                              <span>Refunded</span>
                              <span>
                                -{money(Number(order.refunded_amount || 0), orderCurrency)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label>
                            <span className="mb-2 block text-xs font-medium text-slate-500">
                              Order status
                            </span>

                            <select
                              value={order.status || "pending"}
                              onChange={(event) =>
                                updateOrderStatus(order.id, event.target.value)
                              }
                              disabled={updatingId === order.id}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                            >
                              <option value="pending">Pending</option>
                              <option value="processing">Processing</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </label>

                          <label>
                            <span className="mb-2 block text-xs font-medium text-slate-500">
                              Delivery status
                            </span>

                            <select
                              value={order.delivery_status || "pending"}
                              onChange={(event) =>
                                updateDeliveryStatus(order.id, event.target.value)
                              }
                              disabled={updatingId === order.id}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                            >
                              <option value="pending">Pending</option>
                              <option value="preparing">Preparing</option>
                              <option value="out_for_delivery">Out for delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="failed">Failed</option>
                              <option value="returned">Returned</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>

                    <OrderProgress
                      paymentStatus={order.payment_status}
                      orderStatus={order.status}
                      deliveryStatus={order.delivery_status}
                      settings={storefrontSettings}
                    />
                  </div>

                  {order.order_items && order.order_items.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-950">
                          Items
                        </p>

                        <p className="text-xs text-slate-500">
                          {order.order_items.length} item(s)
                        </p>
                      </div>

                      <div className="space-y-3">
                        {visibleItems.map((item) => {
                          const product = getProduct(item);
                          const variant = getVariant(item);

                          return (
                            <div
                              key={item.id}
                              className="flex flex-col gap-3 rounded-2xl bg-white p-4 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <p className="font-medium text-slate-950">
                                  {product?.name || "Product"}
                                </p>

                                {variant && (
                                  <p
                                    className="mt-1 text-xs font-medium"
                                    style={{
                                      color: storefrontSettings.accent_color,
                                    }}
                                  >
                                    {variant.option_name}: {variant.option_value}
                                    {variant.sku ? ` · SKU: ${variant.sku}` : ""}
                                  </p>
                                )}
                              </div>

                              <p className="text-sm text-slate-600">
                                Qty {item.quantity} ×{" "}
                                {money(Number(item.price), orderCurrency)}
                              </p>
                            </div>
                          );
                        })}

                        {hiddenItemCount > 0 && (
                          <p className="text-xs text-slate-500">
                            +{hiddenItemCount} more item(s)
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  danger,
}: {
  label: string;
  value: string | number;
  helper: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-sm ${
        danger ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className={danger ? "text-sm text-red-600" : "text-sm text-slate-500"}>
        {label}
      </p>
      <h2
        className={`mt-2 text-3xl font-bold ${
          danger ? "text-red-700" : "text-slate-950"
        }`}
      >
        {value}
      </h2>
      <p className={danger ? "mt-2 text-xs text-red-500" : "mt-2 text-xs text-slate-400"}>
        {helper}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "green" | "red" | "purple";
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-green-200 bg-green-50 text-green-800",
    red: "border-red-200 bg-red-50 text-red-800",
    purple: "border-purple-200 bg-purple-50 text-purple-800",
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm opacity-80">{label}</p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}

function HeroMiniRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function StatusBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${className}`}
    >
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function OrderProgress({
  paymentStatus,
  orderStatus,
  deliveryStatus,
  settings,
}: {
  paymentStatus: string | null;
  orderStatus: string | null;
  deliveryStatus: string | null;
  settings: StorefrontSettings;
}) {
  const paid = paymentStatus === "paid" || paymentStatus === "refunded";
  const processing = ["processing", "completed"].includes(orderStatus || "");
  const outForDelivery = ["out_for_delivery", "delivered"].includes(
    deliveryStatus || ""
  );
  const delivered = deliveryStatus === "delivered";

  const steps = [
    {
      label: "Paid",
      complete: paid,
    },
    {
      label: "Processing",
      complete: processing,
    },
    {
      label: "Out for delivery",
      complete: outForDelivery,
    },
    {
      label: "Delivered",
      complete: delivered,
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className="rounded-2xl border p-4"
          style={{
            borderColor: step.complete
              ? `${settings.accent_color}55`
              : "#e2e8f0",
            backgroundColor: step.complete
              ? `${settings.accent_color}10`
              : "#ffffff",
          }}
        >
          <div
            className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
            style={{
              backgroundColor: step.complete
                ? settings.accent_color
                : "#f1f5f9",
              color: step.complete ? "#ffffff" : "#94a3b8",
            }}
          >
            {step.complete ? "✓" : index + 1}
          </div>

          <p
            className="text-sm font-semibold"
            style={{
              color: step.complete ? settings.primary_color : "#64748b",
            }}
          >
            {step.label}
          </p>
        </div>
      ))}
    </div>
  );
}