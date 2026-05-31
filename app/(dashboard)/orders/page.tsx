"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

function money(amount: number, currency = "GHS") {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function formatStatus(value: string | null | undefined) {
  return (value || "pending").replaceAll("_", " ");
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
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const getProduct = (item: OrderItem) =>
    Array.isArray(item.product) ? item.product[0] : item.product;

  const getVariant = (item: OrderItem) =>
    Array.isArray(item.variant) ? item.variant[0] : item.variant;

  const stats = useMemo(() => {
    const totalOrders = orders.length;

    const paidOrders = orders.filter(
      (order) => order.payment_status === "paid"
    ).length;

    const pendingOrders = orders.filter(
      (order) => (order.status || "pending") === "pending"
    ).length;

    const activeDeliveries = orders.filter((order) =>
      ["pending", "preparing", "out_for_delivery"].includes(
        order.delivery_status || "pending"
      )
    ).length;

    const revenue = orders
      .filter((order) => order.payment_status === "paid")
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    return {
      totalOrders,
      paidOrders,
      pendingOrders,
      activeDeliveries,
      revenue,
    };
  }, [orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

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
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%)]" />

        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
          <div className="lg:col-span-2">
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Merchant order management
            </div>

            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Manage customer orders, fulfillment, refunds, and payments.
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              Review recent purchases, update order status, monitor delivery
              progress, track payment outcomes, and keep customers informed.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/products"
                className="rounded-2xl bg-white px-6 py-4 text-center font-semibold text-slate-950 hover:bg-slate-200"
              >
                Manage products
              </a>

              <a
                href="/dashboard"
                className="rounded-2xl border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10"
              >
                Dashboard overview
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
                <HeroMiniRow
                  label="Pending orders"
                  value={stats.pendingOrders}
                />
                <HeroMiniRow
                  label="Active deliveries"
                  value={stats.activeDeliveries}
                />
                <HeroMiniRow
                  label="Paid revenue"
                  value={money(stats.revenue)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <StatCard
          label="Total orders"
          value={stats.totalOrders}
          helper="All customer orders"
        />
        <StatCard
          label="Paid orders"
          value={stats.paidOrders}
          helper="Successful payments"
        />
        <StatCard
          label="Pending"
          value={stats.pendingOrders}
          helper="Needs attention"
        />
        <StatCard
          label="Deliveries"
          value={stats.activeDeliveries}
          helper="In progress"
        />
        <StatCard
          label="Revenue"
          value={money(stats.revenue)}
          helper="Paid orders"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Orders
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Recent orders
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {orders.length} order(s) found for this store.
            </p>
          </div>

          <button
            onClick={fetchOrders}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loading ? (
          <EmptyState text="Loading orders..." />
        ) : orders.length === 0 ? (
          <EmptyState text="No orders yet." />
        ) : (
          <div className="space-y-5">
            {orders.map((order) => {
              const currency = order.currency || "GHS";
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
                  <div className="p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            #{order.id.slice(0, 8)}
                          </span>

                          <StatusBadge
                            label={formatStatus(order.status)}
                            className={getStatusBadgeClass(order.status)}
                          />

                          <StatusBadge
                            label={`Payment: ${formatStatus(
                              order.payment_status
                            )}`}
                            className={getStatusBadgeClass(
                              order.payment_status
                            )}
                          />

                          <StatusBadge
                            label={`Delivery: ${formatStatus(
                              order.delivery_status
                            )}`}
                            className={getStatusBadgeClass(
                              order.delivery_status
                            )}
                          />

                          {order.coupon_code && (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                              Coupon: {order.coupon_code}
                            </span>
                          )}

                          {order.refund_status &&
                            order.refund_status !== "none" && (
                              <StatusBadge
                                label={`Refund: ${formatStatus(
                                  order.refund_status
                                )}`}
                                className={getStatusBadgeClass(
                                  order.refund_status
                                )}
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
                            {order.shipping_area
                              ? ` · ${order.shipping_area}`
                              : ""}
                            {order.shipping_city
                              ? `, ${order.shipping_city}`
                              : ""}
                            {order.shipping_region
                              ? `, ${order.shipping_region}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-5 xl:min-w-[300px]">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-xs text-slate-500">
                              Order total
                            </p>
                            <p className="mt-1 text-3xl font-bold text-slate-950">
                              {money(Number(order.total_amount || 0), currency)}
                            </p>
                          </div>

                          <a
                            href={`/orders/${order.id}`}
                            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                          >
                            View
                          </a>
                        </div>

                        <div className="mt-4 space-y-2 text-xs">
                          {Number(order.discount_amount || 0) > 0 && (
                            <div className="flex justify-between text-green-700">
                              <span>Discount</span>
                              <span>
                                -
                                {money(
                                  Number(order.discount_amount || 0),
                                  currency
                                )}
                              </span>
                            </div>
                          )}

                          {Number(order.refunded_amount || 0) > 0 && (
                            <div className="flex justify-between text-purple-700">
                              <span>Refunded</span>
                              <span>
                                -
                                {money(
                                  Number(order.refunded_amount || 0),
                                  currency
                                )}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-5">
                          <label className="mb-2 block text-xs font-medium text-slate-500">
                            Order status
                          </label>

                          <select
                            value={order.status || "pending"}
                            onChange={(e) =>
                              updateOrderStatus(order.id, e.target.value)
                            }
                            disabled={updatingId === order.id}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-50"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <OrderProgress
                      paymentStatus={order.payment_status}
                      orderStatus={order.status}
                      deliveryStatus={order.delivery_status}
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
                                  <p className="mt-1 text-xs text-blue-700">
                                    {variant.option_name}:{" "}
                                    {variant.option_value}
                                    {variant.sku ? ` · SKU: ${variant.sku}` : ""}
                                  </p>
                                )}
                              </div>

                              <p className="text-sm text-slate-600">
                                Qty {item.quantity} ×{" "}
                                {money(Number(item.price), currency)}
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
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-950">{value}</h2>
      <p className="mt-2 text-xs text-slate-400">{helper}</p>
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
}: {
  paymentStatus: string | null;
  orderStatus: string | null;
  deliveryStatus: string | null;
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
          className={`rounded-2xl border p-4 ${
            step.complete
              ? "border-green-200 bg-green-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div
            className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
              step.complete
                ? "bg-green-600 text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {step.complete ? "✓" : index + 1}
          </div>

          <p
            className={`text-sm font-semibold ${
              step.complete ? "text-green-800" : "text-slate-500"
            }`}
          >
            {step.label}
          </p>
        </div>
      ))}
    </div>
  );
}