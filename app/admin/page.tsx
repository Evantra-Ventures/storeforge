"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string | null;
  created_at: string;
  currency: string | null;
};

type Order = {
  id: string;
  tenant_id: string;
  total_amount: number;
  payment_status: string | null;
  status: string | null;
  created_at: string;
};

type Payout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  requested_at: string;
};

const allowedAdminRoles = ["platform_admin", "admin", "super_admin"];

export default function AdminOverviewPage() {
  const supabase = createClient();

  const [stores, setStores] = useState<Tenant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);

  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const money = (amount: number, currency = "GHS") =>
    `${currency} ${Number(amount || 0).toFixed(2)}`;

  const fetchAdminOverview = async () => {
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
        setErrorMessage("Only platform admins can access this dashboard.");
        return;
      }

      setIsPlatformAdmin(true);

      const [{ data: tenantsData }, { data: ordersData }, { data: payoutsData }] =
        await Promise.all([
          supabase
            .from("tenants")
            .select("id,name,slug,status,created_at,currency")
            .order("created_at", { ascending: false }),

          supabase
            .from("orders")
            .select("id,tenant_id,total_amount,payment_status,status,created_at")
            .order("created_at", { ascending: false })
            .limit(100),

          supabase
            .from("merchant_payouts")
            .select("id,amount,currency,status,requested_at")
            .order("requested_at", { ascending: false })
            .limit(100),
        ]);

      setStores((tenantsData || []) as Tenant[]);
      setOrders((ordersData || []) as Order[]);
      setPayouts((payoutsData || []) as Payout[]);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load admin overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const paidOrders = orders.filter((order) => order.payment_status === "paid");
    const paymentReviewOrders = orders.filter(
      (order) =>
        order.payment_status === "payment_review" ||
        order.status === "payment_review"
    );

    return {
      totalStores: stores.length,
      activeStores: stores.filter((store) => store.status === "active").length,
      draftStores: stores.filter((store) => store.status === "draft").length,
      pausedStores: stores.filter((store) => store.status === "paused").length,
      suspendedStores: stores.filter((store) => store.status === "suspended")
        .length,
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      paymentReviewOrders: paymentReviewOrders.length,
      revenue: paidOrders.reduce(
        (acc, order) => acc + Number(order.total_amount || 0),
        0
      ),
      pendingPayouts: payouts.filter((payout) => payout.status === "pending")
        .length,
      pendingPayoutAmount: payouts
        .filter((payout) => payout.status === "pending")
        .reduce((acc, payout) => acc + Number(payout.amount || 0), 0),
    };
  }, [stores, orders, payouts]);

  const recentStores = stores.slice(0, 5);
  const recentOrders = orders.slice(0, 5);
  const pendingPayouts = payouts
    .filter((payout) => payout.status === "pending")
    .slice(0, 5);

  if (loading) {
    return <p className="text-slate-500">Loading admin overview...</p>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-slate-500">
          Only platform admins can access this dashboard.
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
              StoreForge platform admin
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              Admin Overview
            </h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Monitor stores, payments, payout requests, payment reviews, and
              platform activity across all tenants.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/stores"
              className="rounded-2xl bg-white px-5 py-3 font-semibold text-slate-950 hover:bg-slate-200"
            >
              Manage stores
            </Link>

            <Link
              href="/admin/payouts"
              className="rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/10"
            >
              Review payouts
            </Link>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total stores" value={stats.totalStores} />
        <StatCard label="Active stores" value={stats.activeStores} tone="success" />
        <StatCard label="Paid orders" value={stats.paidOrders} />
        <StatCard label="Revenue tracked" value={money(stats.revenue)} />
        <StatCard label="Draft stores" value={stats.draftStores} />
        <StatCard label="Paused stores" value={stats.pausedStores} tone="warning" />
        <StatCard
          label="Suspended stores"
          value={stats.suspendedStores}
          tone="danger"
        />
        <StatCard
          label="Payment review"
          value={stats.paymentReviewOrders}
          tone={stats.paymentReviewOrders > 0 ? "danger" : "normal"}
        />
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <DashboardPanel
          title="Recent stores"
          subtitle="Latest merchant stores created on the platform."
          actionHref="/admin/stores"
          actionLabel="View all"
        >
          {recentStores.length === 0 ? (
            <EmptyState text="No stores yet." />
          ) : (
            <div className="space-y-4">
              {recentStores.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{store.name}</p>
                    <p className="text-sm text-slate-500">/{store.slug}</p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(
                      store.status || "draft"
                    )}`}
                  >
                    {store.status || "draft"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Recent orders"
          subtitle="Latest order activity across tenants."
          actionHref="/admin/orders"
          actionLabel="View orders"
        >
          {recentOrders.length === 0 ? (
            <EmptyState text="No orders yet." />
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-slate-950">
                      Order #{order.id.slice(0, 8)}
                    </p>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getPaymentClass(
                        order.payment_status || "pending"
                      )}`}
                    >
                      {order.payment_status || "pending"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    {money(Number(order.total_amount || 0))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Pending payouts"
          subtitle="Payout requests waiting for admin action."
          actionHref="/admin/payouts"
          actionLabel="Review"
        >
          {pendingPayouts.length === 0 ? (
            <EmptyState text="No pending payouts." />
          ) : (
            <div className="space-y-4">
              {pendingPayouts.map((payout) => (
                <div
                  key={payout.id}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-slate-950">
                      Payout #{payout.id.slice(0, 8)}
                    </p>

                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
                      Pending
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    {money(Number(payout.amount || 0), payout.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </section>
    </div>
  );
}

function DashboardPanel({
  title,
  subtitle,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  subtitle: string;
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>

        <Link
          href={actionHref}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          {actionLabel}
        </Link>
      </div>

      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-10 text-center text-slate-500">
      {text}
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

function getStatusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "paused":
      return "bg-yellow-100 text-yellow-700";
    case "suspended":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
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
    default:
      return "bg-slate-100 text-slate-700";
  }
}