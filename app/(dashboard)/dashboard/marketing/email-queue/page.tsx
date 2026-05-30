"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EmailQueueItem = {
  id: string;
  tenant_id: string;
  customer_notification_id: string | null;
  customer_profile_id: string | null;
  user_id: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  type: string;
  priority: string;
  provider: string | null;
  provider_message_id: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  scheduled_at: string;
  sent_at: string | null;
  failed_at: string | null;
  created_at: string;
};

export default function EmailQueuePage() {
  const supabase = createClient();

  const [items, setItems] = useState<EmailQueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      processing: items.filter((item) => item.status === "processing").length,
      sent: items.filter((item) => item.status === "sent").length,
      failed: items.filter((item) => item.status === "failed").length,
      cancelled: items.filter((item) => item.status === "cancelled").length,
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const formatLabel = (value: string) => value.replaceAll("_", " ");

  const getStatusClass = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const fetchQueue = async () => {
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
        setErrorMessage("Tenant profile not found.");
        return;
      }

      const { data, error } = await supabase
        .from("notification_email_queue")
        .select(`
          id,
          tenant_id,
          customer_notification_id,
          customer_profile_id,
          user_id,
          to_email,
          subject,
          body_text,
          type,
          priority,
          provider,
          provider_message_id,
          status,
          attempts,
          max_attempts,
          error_message,
          scheduled_at,
          sent_at,
          failed_at,
          created_at
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setItems(data || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load email queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processQueue = async () => {
    try {
      setProcessingQueue(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch("/api/email/process-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: 10,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Failed to process queue.");
        return;
      }

      setSuccessMessage(
        `Processed ${data.processed || 0}. Sent: ${
          data.sent || 0
        }. Failed: ${data.failed || 0}. Skipped: ${data.skipped || 0}.`
      );

      await fetchQueue();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to process email queue.");
    } finally {
      setProcessingQueue(false);
    }
  };

  const retryEmail = async (emailQueueId: string) => {
    try {
      setRetryingId(emailQueueId);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch("/api/email/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailQueueId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Failed to retry email.");
        return;
      }

      setSuccessMessage("Email queued for retry.");
      await fetchQueue();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to retry email.");
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return <p className="text-slate-500">Loading email queue...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Email Queue</h1>
          <p className="text-slate-500 mt-2">
            Monitor queued, sent, and failed customer notification emails.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <a
            href="/dashboard/marketing/announcements"
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Announcements
          </a>

          <a
            href="/dashboard/marketing/notification-analytics"
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Notification Analytics
          </a>

          <button
            onClick={fetchQueue}
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Refresh
          </button>

          <button
            onClick={processQueue}
            disabled={processingQueue}
            className="bg-black text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
          >
            {processingQueue ? "Processing..." : "Process Queue"}
          </button>
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

      <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Processing" value={stats.processing} />
        <StatCard label="Sent" value={stats.sent} />
        <StatCard label="Failed" value={stats.failed} />
        <StatCard label="Cancelled" value={stats.cancelled} />
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold">Recent Email Queue Items</h2>
            <p className="text-sm text-slate-500 mt-1">
              Showing latest 100 email queue records.
            </p>
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {visibleItems.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            No email queue items found.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <div key={item.id} className="border rounded-2xl p-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs capitalize ${getStatusClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>

                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs capitalize">
                        {formatLabel(item.type)}
                      </span>

                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">
                        {item.priority}
                      </span>
                    </div>

                    <h3 className="font-semibold mt-3">{item.subject}</h3>

                    <p className="text-sm text-slate-500 mt-1 break-all">
                      To: {item.to_email}
                    </p>

                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                      {item.body_text}
                    </p>

                    {item.error_message && (
                      <p className="text-sm text-red-600 mt-2 break-words">
                        Error: {item.error_message}
                      </p>
                    )}
                  </div>

                  <div className="lg:text-right min-w-[190px]">
                    <p className="text-sm text-slate-500">
                      Attempts: {item.attempts}/{item.max_attempts}
                    </p>

                    <p className="text-xs text-slate-400 mt-1">
                      Scheduled {new Date(item.scheduled_at).toLocaleString()}
                    </p>

                    <p className="text-xs text-slate-400 mt-1">
                      Created {new Date(item.created_at).toLocaleString()}
                    </p>

                    {item.sent_at && (
                      <p className="text-xs text-green-600 mt-1">
                        Sent {new Date(item.sent_at).toLocaleString()}
                      </p>
                    )}

                    {item.failed_at && (
                      <p className="text-xs text-red-600 mt-1">
                        Failed {new Date(item.failed_at).toLocaleString()}
                      </p>
                    )}

                    {item.provider && (
                      <p className="text-xs text-slate-400 mt-1">
                        Provider: {item.provider}
                      </p>
                    )}

                    {item.provider_message_id && (
                      <p className="text-xs text-slate-400 mt-1 break-all">
                        Provider ID: {item.provider_message_id}
                      </p>
                    )}

                    {item.status === "failed" && (
                      <button
                        onClick={() => retryEmail(item.id)}
                        disabled={retryingId === item.id}
                        className="mt-3 border px-4 py-2 rounded-xl text-sm hover:bg-slate-100 disabled:opacity-50"
                      >
                        {retryingId === item.id ? "Retrying..." : "Retry"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Production-safe processing</p>
        <p className="mt-1">
          This dashboard now calls <code>/api/email/process-admin</code>. The
          private <code>EMAIL_WORKER_SECRET</code> stays on the server and is no
          longer exposed to the browser.
        </p>
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
    <div className="bg-white rounded-2xl shadow p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="text-3xl font-bold mt-2">{value}</h2>
    </div>
  );
}