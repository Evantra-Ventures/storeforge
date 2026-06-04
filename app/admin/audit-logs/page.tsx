"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuditLog = {
  id: string;
  actor_id: string | null;
  tenant_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  metadata: Record<string, any> | null;
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

const allowedAdminRoles = ["platform_admin", "admin", "super_admin"];

const actionOptions = [
  "store_status_updated",
  "payout_approved",
  "payout_rejected",
  "payout_paid",
  "order_status_updated",
  "store_suspended",
  "store_activated",
];

const entityTypeOptions = ["tenant", "order", "payout", "wallet", "product"];

export default function AdminAuditLogsPage() {
  const supabase = createClient();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const getTenant = (log: AuditLog) => {
    if (!log.tenant) return null;
    return Array.isArray(log.tenant) ? log.tenant[0] : log.tenant;
  };

  const getActor = (log: AuditLog) => {
    if (!log.actor) return null;
    return Array.isArray(log.actor) ? log.actor[0] : log.actor;
  };

  const fetchAuditLogs = async () => {
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
        setErrorMessage("Only platform admins can access audit logs.");
        return;
      }

      setIsPlatformAdmin(true);

      let query = supabase
        .from("platform_audit_logs")
        .select(`
          id,
          actor_id,
          tenant_id,
          action,
          entity_type,
          entity_id,
          old_values,
          new_values,
          metadata,
          created_at,
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
        .limit(300);

      if (actionFilter) {
        query = query.eq("action", actionFilter);
      }

      if (entityTypeFilter) {
        query = query.eq("entity_type", entityTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setLogs((data || []) as AuditLog[]);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, entityTypeFilter]);

  const filteredLogs = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return logs;

    return logs.filter((log) => {
      const tenant = getTenant(log);
      const actor = getActor(log);

      return (
        log.id.toLowerCase().includes(value) ||
        log.action.toLowerCase().includes(value) ||
        log.entity_type.toLowerCase().includes(value) ||
        log.entity_id?.toLowerCase().includes(value) ||
        tenant?.name?.toLowerCase().includes(value) ||
        tenant?.slug?.toLowerCase().includes(value) ||
        actor?.full_name?.toLowerCase().includes(value) ||
        actor?.role?.toLowerCase().includes(value) ||
        JSON.stringify(log.metadata || {}).toLowerCase().includes(value)
      );
    });
  }, [logs, search]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      storeStatusUpdates: logs.filter(
        (log) => log.action === "store_status_updated"
      ).length,
      tenantEvents: logs.filter((log) => log.entity_type === "tenant").length,
      orderEvents: logs.filter((log) => log.entity_type === "order").length,
      payoutEvents: logs.filter((log) => log.entity_type === "payout").length,
    };
  }, [logs]);

  if (loading) {
    return <p className="text-slate-500">Loading audit logs...</p>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-slate-500">
          Only platform admins can access audit logs.
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
              Audit Logs
            </h1>

            <p className="mt-3 max-w-2xl text-slate-300">
              Review admin actions, store status changes, payout activity, and
              important platform events across StoreForge.
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
              href="/admin/orders"
              className="rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/10"
            >
              View orders
            </Link>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <StatCard label="Total logs" value={stats.total} />
        <StatCard label="Store status" value={stats.storeStatusUpdates} />
        <StatCard label="Tenant events" value={stats.tenantEvents} />
        <StatCard label="Order events" value={stats.orderEvents} />
        <StatCard label="Payout events" value={stats.payoutEvents} />
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-xl font-bold">Platform events</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredLogs.length} log(s) shown
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action, store, actor..."
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            />

            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            >
              <option value="">All actions</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <select
              value={entityTypeFilter}
              onChange={(event) => setEntityTypeFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-950"
            >
              <option value="">All entity types</option>
              {entityTypeOptions.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-12 text-center text-slate-500">
            No audit logs found.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredLogs.map((log) => (
              <AuditLogCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AuditLogCard({ log }: { log: AuditLog }) {
  const tenant = Array.isArray(log.tenant) ? log.tenant[0] : log.tenant;
  const actor = Array.isArray(log.actor) ? log.actor[0] : log.actor;

  const oldStatus = log.old_values?.status;
  const newStatus = log.new_values?.status;

  return (
    <div className="rounded-3xl border border-slate-200 p-5 transition hover:shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
              {log.entity_type}
            </span>

            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
              {log.action.replaceAll("_", " ")}
            </span>

            {newStatus && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(
                  String(newStatus)
                )}`}
              >
                {String(newStatus)}
              </span>
            )}
          </div>

          <h3 className="mt-3 text-lg font-bold text-slate-950">
            {formatActionTitle(log.action)}
          </h3>

          <div className="mt-2 space-y-1 text-sm text-slate-500">
            {tenant && (
              <p>
                Store:{" "}
                <Link
                  href={`/store/${tenant.slug}`}
                  target="_blank"
                  className="font-medium text-slate-700 hover:underline"
                >
                  {tenant.name}
                </Link>{" "}
                <span className="text-slate-400">/{tenant.slug}</span>
              </p>
            )}

            <p>
              Actor:{" "}
              <span className="font-medium text-slate-700">
                {actor?.full_name || log.actor_id || "Unknown actor"}
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

          {(oldStatus || newStatus) && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-600">
                From:{" "}
                <strong className="capitalize">
                  {oldStatus ? String(oldStatus) : "N/A"}
                </strong>
              </span>

              <span className="text-slate-400">→</span>

              <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-600">
                To:{" "}
                <strong className="capitalize">
                  {newStatus ? String(newStatus) : "N/A"}
                </strong>
              </span>
            </div>
          )}

          {log.new_values?.status_reason && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">Reason</p>
              <p className="mt-1">{String(log.new_values.status_reason)}</p>
            </div>
          )}

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

          <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
            {tenant && (
              <Link
                href={`/admin/stores`}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Admin stores
              </Link>
            )}

            {tenant && (
              <Link
                href={`/store/${tenant.slug}`}
                target="_blank"
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                View store
              </Link>
            )}
          </div>
        </div>
      </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-950">{value}</h2>
    </div>
  );
}

function formatActionTitle(action: string) {
  switch (action) {
    case "store_status_updated":
      return "Store status updated";
    case "payout_approved":
      return "Payout approved";
    case "payout_rejected":
      return "Payout rejected";
    case "payout_paid":
      return "Payout marked as paid";
    case "order_status_updated":
      return "Order status updated";
    default:
      return action.replaceAll("_", " ");
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "paused":
      return "bg-yellow-100 text-yellow-700";
    case "suspended":
      return "bg-red-100 text-red-700";
    case "draft":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}