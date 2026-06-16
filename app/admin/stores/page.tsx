"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  currency: string;
  contact_email: string | null;
  support_phone: string | null;
  created_at: string;

  status: "draft" | "active" | "paused" | "suspended";
  status_reason: string | null;
  status_updated_at: string | null;
  published_at: string | null;

  paystack_subaccount_code: string | null;
  paystack_business_name: string | null;
  paystack_country: string | null;
  paystack_bank_name: string | null;
  paystack_account_name: string | null;
  paystack_settlement_currency: string | null;
  platform_commission_percentage: number | null;
  payment_fee_bearer: "merchant" | "platform" | null;
  payout_setup_status:
    | "not_started"
    | "pending"
    | "active"
    | "failed"
    | "disabled"
    | null;
  payout_setup_error: string | null;
  payout_setup_updated_at: string | null;
};

const allowedAdminRoles = ["platform_admin", "admin", "super_admin"];

const statusOptions = ["draft", "active", "paused", "suspended"];

const payoutStatusOptions = [
  "not_started",
  "pending",
  "active",
  "failed",
  "disabled",
];

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "GHS").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "GHS";
}

function formatType(value?: string | null) {
  return (value || "not_started").replaceAll("_", " ");
}

function maskReference(value: string | null) {
  if (!value) return "Not created";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not updated";
  return new Date(value).toLocaleString();
}

function isSettlementReady(store: Tenant) {
  return Boolean(
    store.paystack_subaccount_code && store.payout_setup_status === "active"
  );
}

export default function AdminStoresPage() {
  const supabase = createClient();

  const [stores, setStores] = useState<Tenant[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState("");
  const [paymentReadinessFilter, setPaymentReadinessFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fetchStores = async () => {
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
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !allowedAdminRoles.includes(profile?.role || "")) {
        setIsPlatformAdmin(false);
        setErrorMessage("Only platform admins can access store management.");
        return;
      }

      setIsPlatformAdmin(true);

      let query = supabase
        .from("tenants")
        .select(`
          id,
          name,
          slug,
          logo_url,
          banner_url,
          currency,
          contact_email,
          support_phone,
          created_at,
          status,
          status_reason,
          status_updated_at,
          published_at,
          paystack_subaccount_code,
          paystack_business_name,
          paystack_country,
          paystack_bank_name,
          paystack_account_name,
          paystack_settlement_currency,
          platform_commission_percentage,
          payment_fee_bearer,
          payout_setup_status,
          payout_setup_error,
          payout_setup_updated_at
        `)
        .order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      if (payoutStatusFilter) {
        query = query.eq("payout_setup_status", payoutStatusFilter);
      }

      const { data, error } = await query;

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setStores((data || []) as Tenant[]);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load stores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, payoutStatusFilter]);

  const filteredStores = useMemo(() => {
    const value = search.trim().toLowerCase();

    return stores.filter((store) => {
      const matchesSearch =
        !value ||
        store.name.toLowerCase().includes(value) ||
        store.slug.toLowerCase().includes(value) ||
        store.contact_email?.toLowerCase().includes(value) ||
        store.paystack_business_name?.toLowerCase().includes(value) ||
        store.paystack_subaccount_code?.toLowerCase().includes(value);

      const ready = isSettlementReady(store);

      const matchesReadiness =
        !paymentReadinessFilter ||
        (paymentReadinessFilter === "ready" && ready) ||
        (paymentReadinessFilter === "not_ready" && !ready);

      return matchesSearch && matchesReadiness;
    });
  }, [stores, search, paymentReadinessFilter]);

  const totals = useMemo(() => {
    const settlementReady = stores.filter(isSettlementReady).length;
    const settlementNotReady = stores.length - settlementReady;
    const payoutPending = stores.filter(
      (store) => store.payout_setup_status === "pending"
    ).length;
    const payoutFailed = stores.filter(
      (store) => store.payout_setup_status === "failed"
    ).length;

    return {
      all: stores.length,
      draft: stores.filter((store) => store.status === "draft").length,
      active: stores.filter((store) => store.status === "active").length,
      paused: stores.filter((store) => store.status === "paused").length,
      suspended: stores.filter((store) => store.status === "suspended").length,
      settlementReady,
      settlementNotReady,
      payoutPending,
      payoutFailed,
    };
  }, [stores]);

  const updateStoreStatus = async (store: Tenant, nextStatus: string) => {
    const reason =
      prompt(
        `Reason for changing "${store.name}" from ${store.status} to ${nextStatus}:`
      ) || "";

    const confirmed = confirm(
      `Change ${store.name} status from ${store.status} to ${nextStatus}?`
    );

    if (!confirmed) return;

    try {
      setUpdatingId(store.id);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch(`/api/admin/stores/${store.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
          reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Failed to update store status.");
        return;
      }

      setStores((prev) =>
        prev.map((item) =>
          item.id === store.id
            ? {
                ...item,
                status: data.tenant.status,
                status_reason: data.tenant.status_reason,
                status_updated_at: data.tenant.status_updated_at,
                published_at: data.tenant.published_at ?? item.published_at,
              }
            : item
        )
      );

      setSuccessMessage(`Store status updated to ${nextStatus}.`);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update store status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const updatePayoutSetupStatus = async (
    store: Tenant,
    nextStatus: "pending" | "active" | "failed" | "disabled"
  ) => {
    const reason =
      prompt(
        `Optional note for changing "${store.name}" payout setup to ${nextStatus}:`
      ) || null;

    const confirmed = confirm(
      `Change ${store.name} payout setup status to ${nextStatus}?`
    );

    if (!confirmed) return;

    try {
      setUpdatingId(store.id);
      setErrorMessage("");
      setSuccessMessage("");

      const { data, error } = await supabase.rpc(
        "set_tenant_paystack_subaccount",
        {
          p_tenant_id: store.id,
          p_subaccount_code: store.paystack_subaccount_code || "",
          p_status: nextStatus,
          p_error: nextStatus === "failed" ? reason : null,
        }
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const updated = data as Tenant;

      setStores((prev) =>
        prev.map((item) =>
          item.id === store.id
            ? {
                ...item,
                payout_setup_status: updated.payout_setup_status,
                payout_setup_error: updated.payout_setup_error,
                payout_setup_updated_at: updated.payout_setup_updated_at,
                paystack_subaccount_code: updated.paystack_subaccount_code,
              }
            : item
        )
      );

      setSuccessMessage(`Payout setup updated to ${nextStatus}.`);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update payout setup status.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-500">Loading stores...</p>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-slate-500">
          Only platform admins can access store management.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
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
              Store Management
            </h1>

            <p className="mt-3 max-w-3xl text-slate-300">
              Review merchant stores, manage storefront status, and monitor
              Paystack settlement readiness before stores accept online
              payments.
            </p>
          </div>

          <button
            onClick={fetchStores}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200"
          >
            Refresh
          </button>
        </div>
      </section>

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

      {totals.settlementNotReady > 0 && (
        <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 text-yellow-800">
          <p className="font-semibold">Some stores are not payment-ready</p>
          <p className="mt-1 text-sm leading-6">
            {totals.settlementNotReady} store(s) do not have active Paystack
            settlement setup. Customers may be blocked from online checkout for
            those stores.
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <StatCard label="All stores" value={totals.all} />
        <StatCard label="Draft" value={totals.draft} />
        <StatCard label="Active" value={totals.active} tone="success" />
        <StatCard label="Paused" value={totals.paused} tone="warning" />
        <StatCard label="Suspended" value={totals.suspended} tone="danger" />
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatCard
          label="Payment Ready"
          value={totals.settlementReady}
          tone="success"
        />
        <StatCard
          label="Payment Not Ready"
          value={totals.settlementNotReady}
          tone={totals.settlementNotReady > 0 ? "warning" : "normal"}
        />
        <StatCard
          label="Setup Pending"
          value={totals.payoutPending}
          tone={totals.payoutPending > 0 ? "warning" : "normal"}
        />
        <StatCard
          label="Setup Failed"
          value={totals.payoutFailed}
          tone={totals.payoutFailed > 0 ? "danger" : "normal"}
        />
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Merchant stores</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredStores.length} store(s) shown
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, slug, email, subaccount..."
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            >
              <option value="">All store statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select
              value={payoutStatusFilter}
              onChange={(event) => setPayoutStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            >
              <option value="">All payout statuses</option>
              {payoutStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatType(status)}
                </option>
              ))}
            </select>

            <select
              value={paymentReadinessFilter}
              onChange={(event) =>
                setPaymentReadinessFilter(event.target.value)
              }
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            >
              <option value="">All payment readiness</option>
              <option value="ready">Payment ready</option>
              <option value="not_ready">Payment not ready</option>
            </select>
          </div>
        </div>

        {filteredStores.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-12 text-center text-slate-500">
            No stores found.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredStores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                updatingId={updatingId}
                updateStoreStatus={updateStoreStatus}
                updatePayoutSetupStatus={updatePayoutSetupStatus}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StoreCard({
  store,
  updatingId,
  updateStoreStatus,
  updatePayoutSetupStatus,
}: {
  store: Tenant;
  updatingId: string | null;
  updateStoreStatus: (store: Tenant, nextStatus: string) => void;
  updatePayoutSetupStatus: (
    store: Tenant,
    nextStatus: "pending" | "active" | "failed" | "disabled"
  ) => void;
}) {
  const isUpdating = updatingId === store.id;
  const settlementReady = isSettlementReady(store);
  const payoutStatus = store.payout_setup_status || "not_started";

  return (
    <div
      className={`rounded-3xl border p-5 transition hover:shadow-sm ${
        settlementReady
          ? "border-slate-200"
          : "border-yellow-200 bg-yellow-50/30"
      }`}
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex gap-4">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-16 w-16 rounded-2xl border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-2xl font-bold text-white">
              {store.name.slice(0, 1)}
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-slate-950">
                {store.name}
              </h3>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(
                  store.status
                )}`}
              >
                {store.status}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getPayoutStatusClass(
                  payoutStatus
                )}`}
              >
                Settlement: {formatType(payoutStatus)}
              </span>

              {settlementReady ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Payment ready
                </span>
              ) : (
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                  Payment not ready
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-500">/{store.slug}</p>

            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
              {store.contact_email && <span>{store.contact_email}</span>}
              {store.support_phone && <span>{store.support_phone}</span>}
              <span>{normalizeCurrency(store.currency)}</span>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Created {new Date(store.created_at).toLocaleString()}
            </p>

            {store.published_at && (
              <p className="mt-1 text-xs text-green-600">
                Published {new Date(store.published_at).toLocaleString()}
              </p>
            )}

            {store.status_reason && (
              <p className="mt-3 rounded-2xl bg-white p-3 text-sm text-slate-600">
                Status reason: {store.status_reason}
              </p>
            )}

            {store.payout_setup_error && (
              <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Payout setup error: {store.payout_setup_error}
              </p>
            )}
          </div>
        </div>

        <div className="grid min-w-full grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm xl:min-w-[440px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow
              label="Business"
              value={store.paystack_business_name || store.name}
            />
            <InfoRow
              label="Country"
              value={store.paystack_country || "Not set"}
            />
            <InfoRow
              label="Settlement currency"
              value={normalizeCurrency(
                store.paystack_settlement_currency || store.currency
              )}
            />
            <InfoRow
              label="Subaccount"
              value={maskReference(store.paystack_subaccount_code)}
            />
            <InfoRow
              label="Bank"
              value={store.paystack_bank_name || "Not set"}
            />
            <InfoRow
              label="Account name"
              value={store.paystack_account_name || "Not set"}
            />
            <InfoRow
              label="Platform fee"
              value={`${Number(store.platform_commission_percentage || 5)}%`}
            />
            <InfoRow
              label="Paystack fee bearer"
              value={
                store.payment_fee_bearer === "platform"
                  ? "StoreForge"
                  : "Merchant"
              }
            />
          </div>

          <p className="text-xs text-slate-400">
            Settlement updated: {formatDate(store.payout_setup_updated_at)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
        <Link
          href={`/store/${store.slug}`}
          target="_blank"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-white"
        >
          View store
        </Link>

        <Link
          href={`/admin/payouts`}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-white"
        >
          View settlements
        </Link>

        {store.status !== "active" && (
          <button
            onClick={() => updateStoreStatus(store, "active")}
            disabled={isUpdating}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Activate
          </button>
        )}

        {store.status !== "paused" && (
          <button
            onClick={() => updateStoreStatus(store, "paused")}
            disabled={isUpdating}
            className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
          >
            Pause
          </button>
        )}

        {store.status !== "suspended" && (
          <button
            onClick={() => updateStoreStatus(store, "suspended")}
            disabled={isUpdating}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Suspend
          </button>
        )}

        {store.status !== "draft" && (
          <button
            onClick={() => updateStoreStatus(store, "draft")}
            disabled={isUpdating}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            Move to draft
          </button>
        )}

        {payoutStatus !== "active" && store.paystack_subaccount_code && (
          <button
            onClick={() => updatePayoutSetupStatus(store, "active")}
            disabled={isUpdating}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Mark settlement active
          </button>
        )}

        {payoutStatus !== "disabled" && (
          <button
            onClick={() => updatePayoutSetupStatus(store, "disabled")}
            disabled={isUpdating}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-white disabled:opacity-50"
          >
            Disable settlement
          </button>
        )}

        {payoutStatus !== "failed" && (
          <button
            onClick={() => updatePayoutSetupStatus(store, "failed")}
            disabled={isUpdating}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Mark setup failed
          </button>
        )}
      </div>
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
      ? "bg-green-50 border-green-200 text-green-700"
      : tone === "warning"
        ? "bg-yellow-50 border-yellow-200 text-yellow-700"
        : tone === "danger"
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-white border-slate-200 text-slate-950";

  return (
    <div className={`rounded-2xl border p-6 shadow-sm ${toneClass}`}>
      <p className="text-sm opacity-80">{label}</p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-950">{value}</p>
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

function getPayoutStatusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    case "failed":
    case "disabled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}