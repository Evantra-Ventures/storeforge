"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
};

type Order = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  subtotal_amount: number | null;
  discount_amount: number | null;
  shipping_fee: number | null;
  total_amount: number | null;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
  delivery_method: string | null;
  checkout_session_id: string | null;
  created_at: string;
  tenant: Tenant | Tenant[] | null;
};

const allowedAdminRoles = ["platform_admin", "admin", "super_admin"];

const orderStatusOptions = [
  "pending",
  "processing",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "payment_review",
];

const paymentStatusOptions = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "payment_review",
];

export default function AdminOrdersPage() {
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [search, setSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const money = (amount: number, currency = "GHS") =>
    `${currency} ${Number(amount || 0).toFixed(2)}`;

  const getTenant = (order: Order) => {
    if (!order.tenant) return null;
    return Array.isArray(order.tenant) ? order.tenant[0] : order.tenant;
  };

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
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !allowedAdminRoles.includes(profile?.role || "")) {
        setIsPlatformAdmin(false);
        setErrorMessage("Only platform admins can access order monitoring.");
        return;
      }

      setIsPlatformAdmin(true);

      let query = supabase
        .from("orders")
        .select(`
          id,
          tenant_id,
          customer_id,
          customer_name,
          customer_email,
          subtotal_amount,
          discount_amount,
          shipping_fee,
          total_amount,
          currency,
          status,
          payment_status,
          delivery_method,
          checkout_session_id,
          created_at,
          tenant:tenants (
            id,
            name,
            slug,
            status
          )
        `)
        .order("created_at", { ascending: false })
        .limit(300);

      if (orderStatusFilter) {
        query = query.eq("status", orderStatusFilter);
      }

      if (paymentStatusFilter) {
        query = query.eq("payment_status", paymentStatusFilter);
      }

      const { data, error } = await query;

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

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatusFilter, paymentStatusFilter]);

  const filteredOrders = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return orders;

    return orders.filter((order) => {
      const tenant = getTenant(order);

      return (
        order.id.toLowerCase().includes(value) ||
        order.customer_name?.toLowerCase().includes(value) ||
        order.customer_email?.toLowerCase().includes(value) ||
        order.checkout_session_id?.toLowerCase().includes(value) ||
        tenant?.name?.toLowerCase().includes(value) ||
        tenant?.slug?.toLowerCase().includes(value)
      );
    });
  }, [orders, search]);

  const stats = useMemo(() => {
    const paidOrders = orders.filter((order) => order.payment_status === "paid");
    const paymentReviewOrders = orders.filter(
      (order) =>
        order.payment_status === "payment_review" ||
        order.status === "payment_review"
    );

    return {
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      pendingPayments: orders.filter(
        (order) => order.payment_status === "pending"
      ).length,
      failedPayments: orders.filter((order) => order.payment_status === "failed")
        .length,
      cancelledOrders: orders.filter((order) => order.status === "cancelled")
        .length,
      paymentReviewOrders: paymentReviewOrders.length,
      paidRevenue: paidOrders.reduce(
        (acc, order) => acc + Number(order.total_amount || 0),
        0
      ),
      highValueOrders: orders.filter(
        (order) => Number(order.total_amount || 0) >= 1000
      ).length,
    };
  }, [orders]);

  if (loading) {
    return <p className="text-slate-500">Loading platform orders...</p>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-slate-500">
          Only platform admins can access order monitoring.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.38),transparent_34%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_34%)]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
              Platform admin
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              Order Monitoring
            </h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Track orders across all merchant stores, review payment issues,
              monitor failed transactions, and identify orders that need manual
              attention.
            </p>
          </div>

          <Link
            href="/admin/stores"
            className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-950 hover:bg-slate-200"
          >
            Manage stores
          </Link>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      {stats.paymentReviewOrders > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <p className="font-semibold">Payment review required</p>
          <p className="mt-1 text-sm">
            {stats.paymentReviewOrders} order(s) need manual payment review.
            Check for amount mismatches, stock issues, or payment verification
            problems.
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total orders" value={stats.totalOrders} />
        <StatCard label="Paid orders" value={stats.paidOrders} tone="success" />
        <StatCard label="Paid revenue" value={money(stats.paidRevenue)} />
        <StatCard
          label="Payment review"
          value={stats.paymentReviewOrders}
          tone={stats.paymentReviewOrders > 0 ? "danger" : "normal"}
        />
        <StatCard label="Pending payments" value={stats.pendingPayments} />
        <StatCard
          label="Failed payments"
          value={stats.failedPayments}
          tone={stats.failedPayments > 0 ? "warning" : "normal"}
        />
        <StatCard
          label="Cancelled orders"
          value={stats.cancelledOrders}
          tone={stats.cancelledOrders > 0 ? "warning" : "normal"}
        />
        <StatCard
          label="High value orders"
          value={stats.highValueOrders}
          tone={stats.highValueOrders > 0 ? "success" : "normal"}
        />
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-bold">Orders</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredOrders.length} order(s) shown
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, customer, store..."
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            />

            <select
              value={orderStatusFilter}
              onChange={(event) => setOrderStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            >
              <option value="">All order statuses</option>
              {orderStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <select
              value={paymentStatusFilter}
              onChange={(event) => setPaymentStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            >
              <option value="">All payment statuses</option>
              {paymentStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-12 text-center text-slate-500">
            No orders found.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredOrders.map((order) => {
              const tenant = getTenant(order);
              const isReview =
                order.payment_status === "payment_review" ||
                order.status === "payment_review";

              return (
                <div
                  key={order.id}
                  className={`rounded-3xl border p-5 transition hover:shadow-sm ${
                    isReview
                      ? "border-red-200 bg-red-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getPaymentClass(
                            order.payment_status || "pending"
                          )}`}
                        >
                          Payment:{" "}
                          {(order.payment_status || "pending").replaceAll(
                            "_",
                            " "
                          )}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getOrderClass(
                            order.status || "pending"
                          )}`}
                        >
                          Order:{" "}
                          {(order.status || "pending").replaceAll("_", " ")}
                        </span>

                        {Number(order.total_amount || 0) >= 1000 && (
                          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                            High value
                          </span>
                        )}

                        {isReview && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            Needs review
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-slate-950">
                        Order #{order.id.slice(0, 8)}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Store: {tenant?.name || "Unknown store"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Customer: {order.customer_name || "Unknown customer"}
                        {order.customer_email ? ` · ${order.customer_email}` : ""}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Created {new Date(order.created_at).toLocaleString()}
                      </p>

                      {order.checkout_session_id && (
                        <p className="mt-3 break-all rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
                          Reference: {order.checkout_session_id}
                        </p>
                      )}
                    </div>

                    <div className="lg:text-right">
                      <p className="text-3xl font-bold text-slate-950">
                        {money(
                          Number(order.total_amount || 0),
                          order.currency || "GHS"
                        )}
                      </p>

                      <div className="mt-3 space-y-1 text-sm text-slate-500">
                        <p>
                          Subtotal:{" "}
                          {money(
                            Number(order.subtotal_amount || 0),
                            order.currency || "GHS"
                          )}
                        </p>
                        <p>
                          Shipping:{" "}
                          {money(
                            Number(order.shipping_fee || 0),
                            order.currency || "GHS"
                          )}
                        </p>
                        <p>
                          Discount:{" "}
                          {money(
                            Number(order.discount_amount || 0),
                            order.currency || "GHS"
                          )}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
                        {tenant && (
                          <Link
                            href={`/store/${tenant.slug}`}
                            target="_blank"
                            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                          >
                            View store
                          </Link>
                        )}

                        <Link
                          href={`/order-success/${order.id}`}
                          target="_blank"
                          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                          View order
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
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
  tone = "normal",
}: {
  label: string;
  value: string | number;
  tone?: "normal" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "warning"
      ? "border-yellow-200 bg-yellow-50 text-yellow-700"
      : tone === "danger"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-white text-slate-950";

  return (
    <div className={`rounded-2xl border p-6 shadow-sm ${toneClass}`}>
      <p className="text-sm opacity-80">{label}</p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}

function getPaymentClass(status: string) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700";
    case "failed":
    case "payment_review":
      return "bg-red-100 text-red-700";
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    case "refunded":
      return "bg-purple-100 text-purple-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getOrderClass(status: string) {
  switch (status) {
    case "processing":
    case "ready_for_pickup":
    case "out_for_delivery":
      return "bg-blue-100 text-blue-700";
    case "delivered":
      return "bg-green-100 text-green-700";
    case "cancelled":
    case "payment_review":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}