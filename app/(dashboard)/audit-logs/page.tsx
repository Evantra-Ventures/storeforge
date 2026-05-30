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
  metadata: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  tenant:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
  actor:
    | {
        id: string;
        full_name: string | null;
        role: string | null;
      }
    | {
        id: string;
        full_name: string | null;
        role: string | null;
      }[]
    | null;
};

export default function AuditLogsPage() {
  const supabase = createClient();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const money = (value: any, currency = "GHS") => {
    const amount = Number(value || 0);
    return `${currency} ${amount.toFixed(2)}`;
  };

  const formatText = (value: string | null | undefined) =>
    (value || "unknown").replaceAll("_", " ").replaceAll(".", " ");

  const getTenant = (log: AuditLog) => {
    if (!log.tenant) return null;
    return Array.isArray(log.tenant) ? log.tenant[0] : log.tenant;
  };

  const getActor = (log: AuditLog) => {
    if (!log.actor) return null;
    return Array.isArray(log.actor) ? log.actor[0] : log.actor;
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-600 text-white";
      case "danger":
        return "bg-red-100 text-red-700";
      case "warning":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const getActionClass = (action: string) => {
    if (action.includes("refund")) return "bg-red-100 text-red-700";
    if (action.includes("payout.paid")) return "bg-green-100 text-green-700";
    if (action.includes("payout.rejected")) return "bg-orange-100 text-orange-700";
    if (action.includes("payout")) return "bg-purple-100 text-purple-700";
    if (action.includes("wallet")) return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-700";
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
        .single();

      if (profileError || !profile) {
        setErrorMessage("Profile not found.");
        return;
      }

      setTenantId(profile.tenant_id || null);
      setIsPlatformAdmin(profile.role === "platform_admin");

      let query = supabase
        .from("audit_logs")
        .select(`
          *,
          tenant:tenants (
            id,
            name,
            slug
          ),
          actor:profiles (
            id,
            full_name,
            role
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (profile.role !== "platform_admin") {
        query = query.eq("tenant_id", profile.tenant_id);
      }

      const { data, error } = await query;

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setLogs(data || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const tenant = getTenant(log);
      const actor = getActor(log);

      const searchable = [
        log.action,
        log.entity_type,
        log.description,
        log.entity_id,
        tenant?.name,
        tenant?.slug,
        actor?.full_name,
        actor?.role,
        JSON.stringify(log.metadata || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchTerm || searchable.includes(searchTerm.toLowerCase());

      const matchesAction = !actionFilter || log.action === actionFilter;
      const matchesSeverity =
        !severityFilter || log.severity === severityFilter;
      const matchesEntity = !entityFilter || log.entity_type === entityFilter;

      return matchesSearch && matchesAction && matchesSeverity && matchesEntity;
    });
  }, [logs, searchTerm, actionFilter, severityFilter, entityFilter]);

  const uniqueActions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action))).sort();
  }, [logs]);

  const uniqueEntities = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.entity_type))).sort();
  }, [logs]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      info: logs.filter((log) => log.severity === "info").length,
      warnings: logs.filter((log) => log.severity === "warning").length,
      danger: logs.filter(
        (log) => log.severity === "danger" || log.severity === "critical"
      ).length,
      payouts: logs.filter((log) => log.action.includes("payout")).length,
      refunds: logs.filter((log) => log.action.includes("refund")).length,
      wallet: logs.filter((log) => log.action.includes("wallet")).length,
    };
  }, [logs]);

  const resetFilters = () => {
    setSearchTerm("");
    setActionFilter("");
    setSeverityFilter("");
    setEntityFilter("");
  };

  const renderMetadataSummary = (metadata: Record<string, any> | null) => {
    if (!metadata) return null;

    const importantFields = [
      "amount",
      "gross_amount",
      "net_amount",
      "refund_amount",
      "platform_fee_amount",
      "processor_fee_amount",
      "available_deduction",
      "pending_deduction",
      "platform_balance_due_added",
      "external_reference",
      "payout_method",
    ];

    const visibleEntries = importantFields
      .filter((key) => metadata[key] !== undefined && metadata[key] !== null)
      .map((key) => [key, metadata[key]]);

    if (visibleEntries.length === 0) return null;

    return (
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        {visibleEntries.map(([key, value]) => {
          const isMoneyField =
            key.includes("amount") ||
            key.includes("deduction") ||
            key.includes("fee") ||
            key.includes("balance");

          return (
            <div key={key} className="bg-slate-50 border rounded-xl p-3 text-xs">
              <p className="text-slate-500 capitalize">{formatText(key)}</p>
              <p className="font-semibold mt-1">
                {isMoneyField ? money(value) : String(value)}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <p className="text-slate-500">Loading audit logs...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-slate-500 mt-2">
            Track financial actions such as wallet credits, payouts, refund
            deductions, and admin approvals.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {errorMessage && (
        <div className="bg-red-100 text-red-700 p-4 rounded-xl">
          {errorMessage}
        </div>
      )}

      {isPlatformAdmin && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl p-5">
          <p className="font-semibold">Platform Admin View</p>
          <p className="text-sm mt-1">
            You are viewing audit logs across all tenants. Store owners only see
            logs for their own tenant.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Total Logs" value={stats.total} />
        <StatCard label="Wallet Logs" value={stats.wallet} />
        <StatCard label="Payout Logs" value={stats.payouts} />
        <StatCard label="Refund Logs" value={stats.refunds} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Info" value={stats.info} />
        <StatCard label="Warnings" value={stats.warnings} tone="warning" />
        <StatCard label="Danger/Critical" value={stats.danger} tone="danger" />
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Filter Logs</h2>
            <p className="text-sm text-slate-500 mt-1">
              Showing {filteredLogs.length} of {logs.length} log(s)
            </p>
          </div>

          <button
            onClick={resetFilters}
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            className="border rounded-xl p-3"
          />

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="danger">Danger</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All entities</option>
            {uniqueEntities.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold mb-6">Recent Audit Logs</h2>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No audit logs found.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => {
              const tenant = getTenant(log);
              const actor = getActor(log);

              return (
                <div key={log.id} className="border rounded-2xl p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs capitalize ${getSeverityClass(
                            log.severity
                          )}`}
                        >
                          {log.severity}
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full text-xs ${getActionClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>

                        <span className="px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
                          {log.entity_type}
                        </span>
                      </div>

                      <h3 className="font-semibold text-lg mt-3">
                        {log.description || formatText(log.action)}
                      </h3>

                      <div className="text-sm text-slate-500 mt-2 space-y-1">
                        {isPlatformAdmin && (
                          <p>Store: {tenant?.name || "Unknown store"}</p>
                        )}

                        <p>
                          Actor:{" "}
                          {actor?.full_name ||
                            actor?.role ||
                            log.actor_id ||
                            "System"}
                        </p>

                        {log.entity_id && (
                          <p>Entity ID: #{log.entity_id.slice(0, 8)}</p>
                        )}

                        <p>{new Date(log.created_at).toLocaleString()}</p>
                      </div>

                      {renderMetadataSummary(log.metadata)}
                    </div>

                    <div className="lg:text-right">
                      <p className="text-xs text-slate-400">Log ID</p>
                      <p className="font-mono text-xs text-slate-500 mt-1">
                        {log.id.slice(0, 8)}
                      </p>

                      {log.ip_address && (
                        <p className="text-xs text-slate-400 mt-3">
                          IP: {log.ip_address}
                        </p>
                      )}
                    </div>
                  </div>

                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-slate-500 hover:text-black">
                        View raw metadata
                      </summary>

                      <pre className="mt-3 bg-slate-950 text-slate-100 rounded-2xl p-4 text-xs overflow-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
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
  tone?: "normal" | "warning" | "danger";
}) {
  return (
    <div
      className={`rounded-2xl shadow p-6 ${
        tone === "danger"
          ? "bg-red-50 border border-red-200"
          : tone === "warning"
            ? "bg-yellow-50 border border-yellow-200"
            : "bg-white"
      }`}
    >
      <p
        className={`text-sm ${
          tone === "danger"
            ? "text-red-600"
            : tone === "warning"
              ? "text-yellow-700"
              : "text-slate-500"
        }`}
      >
        {label}
      </p>

      <h2
        className={`text-3xl font-bold mt-2 ${
          tone === "danger"
            ? "text-red-700"
            : tone === "warning"
              ? "text-yellow-800"
              : ""
        }`}
      >
        {value}
      </h2>
    </div>
  );
}