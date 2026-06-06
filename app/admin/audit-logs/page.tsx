"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuditLog = {
  id: string;
  tenant_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  severity: "info" | "warning" | "danger" | "critical";
  description: string | null;
  metadata: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type ActorProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

const actionOptions = [
  "wallet_credited",
  "wallet_debited",
  "payout_requested",
  "payout_approved",
  "payout_rejected",
  "payout_paid",
  "refund_deducted",
  "order_status_updated",
  "payment_review",
  "store_status_updated",
];

const severityOptions = ["info", "warning", "danger", "critical"];

const entityTypeOptions = [
  "wallet",
  "payout",
  "refund",
  "order",
  "payment",
  "tenant",
  "product",
];

export default function AuditLogsPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actorProfiles, setActorProfiles] = useState<Record<string, ActorProfile>>({});

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchActorProfiles = async (items: AuditLog[]) => {
    const actorIds = Array.from(
      new Set(items.map((item) => item.actor_id).filter(Boolean))
    ) as string[];

    if (actorIds.length === 0) {
      setActorProfiles({});
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .in("id", actorIds);

    if (error) {
      console.warn("Could not load actor profiles:", error.message);
      setActorProfiles({});
      return;
    }

    const profileMap: Record<string, ActorProfile> = {};

    for (const profile of data || []) {
      profileMap[profile.id] = profile;
    }

    setActorProfiles(profileMap);
  };

  const fetchLogs = async () => {
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
        .select("tenant_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile?.tenant_id) {
        setErrorMessage("Tenant profile not found.");
        return;
      }

      setTenantId(profile.tenant_id);

      let query = supabase
        .from("audit_logs")
        .select(`
          id,
          tenant_id,
          actor_id,
          action,
          entity_type,
          entity_id,
          severity,
          description,
          metadata,
          ip_address,
          user_agent,
          created_at
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(300);

      if (actionFilter) {
        query = query.eq("action", actionFilter);
      }

      if (severityFilter) {
        query = query.eq("severity", severityFilter);
      }

      if (entityTypeFilter) {
        query = query.eq("entity_type", entityTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const loadedLogs = (data || []) as AuditLog[];

      setLogs(loadedLogs);
      await fetchActorProfiles(loadedLogs);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, severityFilter, entityTypeFilter]);

  const filteredLogs = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return logs;

    return logs.filter((log) => {
      const actor = log.actor_id ? actorProfiles[log.actor_id] : null;

      return (
        log.id.toLowerCase().includes(value) ||
        log.action.toLowerCase().includes(value) ||
        log.entity_type.toLowerCase().includes(value) ||
        log.entity_id?.toLowerCase().includes(value) ||
        log.description?.toLowerCase().includes(value) ||
        actor?.full_name?.toLowerCase().includes(value) ||
        actor?.role?.toLowerCase().includes(value) ||
        JSON.stringify(log.metadata || {}).toLowerCase().includes(value)
      );
    });
  }, [logs, search, actorProfiles]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      wallet: logs.filter((log) => log.entity_type === "wallet").length,
      payout: logs.filter((log) => log.entity_type === "payout").length,
      refund: logs.filter((log) => log.entity_type === "refund").length,
      info: logs.filter((log) => log.severity === "info").length,
      warning: logs.filter((log) => log.severity === "warning").length,
      danger: logs.filter(
        (log) => log.severity === "danger" || log.severity === "critical"
      ).length,
    };
  }, [logs]);

  const resetFilters = () => {
    setSearch("");
    setActionFilter("");
    setSeverityFilter("");
    setEntityTypeFilter("");
  };

  if (loading) {
    return <p className="text-slate-500">Loading audit logs...</p>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Audit Logs
          </h1>

          <p className="mt-2 max-w-3xl text-slate-500">
            Track financial actions such as wallet credits, payouts, refund
            deductions, order events, and admin approvals.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50 sm:w-fit"
        >
          Refresh
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-2xl bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Logs" value={stats.total} />
        <StatCard label="Wallet Logs" value={stats.wallet} />
        <StatCard label="Payout Logs" value={stats.payout} />
        <StatCard label="Refund Logs" value={stats.refund} />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Info" value={stats.info} tone="normal" />
        <StatCard label="Warnings" value={stats.warning} tone="warning" />
        <StatCard label="Danger/Critical" value={stats.danger} tone="danger" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Filter Logs</h2>
            <p className="mt-1 text-sm text-slate-500">
              Showing {filteredLogs.length} of {logs.length} log(s)
            </p>
          </div>

          <button
            onClick={resetFilters}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50 sm:w-fit"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search logs..."
            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
          />

          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
          >
            <option value="">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action.replaceAll("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
          >
            <option value="">All severities</option>
            {severityOptions.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>

          <select
            value={entityTypeFilter}
            onChange={(event) => setEntityTypeFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
          >
            <option value="">All entities</option>
            {entityTypeOptions.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold">Recent Audit Logs</h2>

        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            No audit logs found.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {filteredLogs.map((log) => (
              <AuditLogCard
                key={log.id}
                log={log}
                actor={log.actor_id ? actorProfiles[log.actor_id] : null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AuditLogCard({
  log,
  actor,
}: {
  log: AuditLog;
  actor: ActorProfile | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 transition hover:bg-slate-50">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getSeverityClass(
                log.severity
              )}`}
            >
              {log.severity}
            </span>

            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
              {log.entity_type}
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
              {log.action.replaceAll("_", " ")}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-bold text-slate-950">
            {formatActionTitle(log.action)}
          </h3>

          {log.description && (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {log.description}
            </p>
          )}

          <div className="mt-3 space-y-1 text-sm text-slate-500">
            <p>
              Actor:{" "}
              <span className="font-medium text-slate-700">
                {actor?.full_name || log.actor_id || "System"}
              </span>
              {actor?.role ? (
                <span className="text-slate-400"> · {actor.role}</span>
              ) : null}
            </p>

            <p>Entity ID: {log.entity_id || "N/A"}</p>

            <p className="text-xs text-slate-400">
              {new Date(log.created_at).toLocaleString()}
            </p>
          </div>

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                View metadata
              </summary>

              <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>

        <div className="lg:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Log ID
          </p>

          <p className="mt-1 break-all text-sm font-semibold text-slate-700">
            {log.id}
          </p>

          {log.ip_address && (
            <p className="mt-3 text-xs text-slate-400">IP: {log.ip_address}</p>
          )}
        </div>
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
  tone?: "normal" | "warning" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "border-yellow-200 bg-yellow-50 text-yellow-800"
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

function formatActionTitle(action: string) {
  switch (action) {
    case "wallet_credited":
      return "Wallet credited";
    case "wallet_debited":
      return "Wallet debited";
    case "payout_requested":
      return "Payout requested";
    case "payout_approved":
      return "Payout approved";
    case "payout_rejected":
      return "Payout rejected";
    case "payout_paid":
      return "Payout marked as paid";
    case "refund_deducted":
      return "Refund deducted";
    case "order_status_updated":
      return "Order status updated";
    case "payment_review":
      return "Payment review";
    case "store_status_updated":
      return "Store status updated";
    default:
      return action.replaceAll("_", " ");
  }
}

function getSeverityClass(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-200 text-red-900";
    case "danger":
      return "bg-red-100 text-red-700";
    case "warning":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}