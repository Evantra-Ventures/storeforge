"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NotificationSummary = {
  tenant_id: string;
  total_notifications: number;
  unread_notifications: number;
  read_notifications: number;
  archived_notifications: number;
  order_notifications: number;
  delivery_notifications: number;
  refund_notifications: number;
  loyalty_notifications: number;
  wishlist_notifications: number;
  marketing_notifications: number;
  high_priority_notifications: number;
  notifications_last_7_days: number;
  notifications_last_30_days: number;
  last_notification_at: string | null;
};

type TypeAnalytics = {
  tenant_id: string;
  type: string;
  channel: string;
  priority: string;
  total_count: number;
  unread_count: number;
  read_count: number;
  count_last_7_days: number;
  count_last_30_days: number;
  last_sent_at: string | null;
};

type CampaignAnalytics = {
  tenant_id: string;
  total_campaigns: number;
  sent_campaigns: number;
  failed_campaigns: number;
  draft_campaigns: number;
  total_campaign_notifications_sent: number;
  total_campaign_notifications_failed: number;
  coupon_campaigns: number;
  marketing_campaigns: number;
  campaigns_last_7_days: number;
  campaigns_last_30_days: number;
  last_campaign_sent_at: string | null;
};

type Campaign = {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  priority: string;
  sent_count: number;
  failed_count: number;
  status: string;
  sent_at: string | null;
  created_at: string;
};

export default function NotificationAnalyticsPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [typeAnalytics, setTypeAnalytics] = useState<TypeAnalytics[]>([]);
  const [campaignAnalytics, setCampaignAnalytics] =
    useState<CampaignAnalytics | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const formatLabel = (value: string) => value.replaceAll("_", " ");

  const fetchAnalytics = async () => {
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
        setErrorMessage("Tenant profile not found.");
        return;
      }

      setTenantId(profile.tenant_id);

      const { data: summaryData } = await supabase
        .from("notification_analytics_summary")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      setSummary(summaryData || null);

      const { data: typeData, error: typeError } = await supabase
        .from("notification_type_analytics")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("total_count", { ascending: false });

      if (typeError) {
        setErrorMessage(typeError.message);
        return;
      }

      setTypeAnalytics(typeData || []);

      const { data: campaignSummaryData } = await supabase
        .from("notification_campaign_analytics")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      setCampaignAnalytics(campaignSummaryData || null);

      const { data: campaignData, error: campaignError } = await supabase
        .from("customer_notification_campaigns")
        .select(`
          id,
          title,
          message,
          type,
          audience,
          priority,
          sent_count,
          failed_count,
          status,
          sent_at,
          created_at
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (campaignError) {
        setErrorMessage(campaignError.message);
        return;
      }

      setCampaigns(campaignData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load notification analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const readRate = useMemo(() => {
    const total = Number(summary?.total_notifications || 0);
    const read = Number(summary?.read_notifications || 0);

    if (total <= 0) return 0;

    return Math.round((read / total) * 100);
  }, [summary]);

  const campaignSuccessRate = useMemo(() => {
    const sent = Number(campaignAnalytics?.total_campaign_notifications_sent || 0);
    const failed = Number(
      campaignAnalytics?.total_campaign_notifications_failed || 0
    );

    const total = sent + failed;

    if (total <= 0) return 0;

    return Math.round((sent / total) * 100);
  }, [campaignAnalytics]);

  if (loading) {
    return <p className="text-slate-500">Loading notification analytics...</p>;
  }

  const safeSummary = summary || {
    tenant_id: tenantId || "",
    total_notifications: 0,
    unread_notifications: 0,
    read_notifications: 0,
    archived_notifications: 0,
    order_notifications: 0,
    delivery_notifications: 0,
    refund_notifications: 0,
    loyalty_notifications: 0,
    wishlist_notifications: 0,
    marketing_notifications: 0,
    high_priority_notifications: 0,
    notifications_last_7_days: 0,
    notifications_last_30_days: 0,
    last_notification_at: null,
  };

  const safeCampaignAnalytics = campaignAnalytics || {
    tenant_id: tenantId || "",
    total_campaigns: 0,
    sent_campaigns: 0,
    failed_campaigns: 0,
    draft_campaigns: 0,
    total_campaign_notifications_sent: 0,
    total_campaign_notifications_failed: 0,
    coupon_campaigns: 0,
    marketing_campaigns: 0,
    campaigns_last_7_days: 0,
    campaigns_last_30_days: 0,
    last_campaign_sent_at: null,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notification Analytics</h1>
          <p className="text-slate-500 mt-2">
            Track customer notification performance, campaign delivery, and
            engagement.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <a
            href="/dashboard/marketing/announcements"
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Announcements
          </a>

          <button
            onClick={fetchAnalytics}
            className="bg-black text-white px-4 py-2 rounded-xl text-sm hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-100 text-red-700 p-4 rounded-xl">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard
          label="Total Notifications"
          value={safeSummary.total_notifications}
        />
        <StatCard label="Unread" value={safeSummary.unread_notifications} />
        <StatCard label="Read Rate" value={`${readRate}%`} />
        <StatCard
          label="Last 30 Days"
          value={safeSummary.notifications_last_30_days}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard
          label="Campaigns"
          value={safeCampaignAnalytics.total_campaigns}
        />
        <StatCard
          label="Campaign Sent"
          value={safeCampaignAnalytics.total_campaign_notifications_sent}
        />
        <StatCard
          label="Campaign Failed"
          value={safeCampaignAnalytics.total_campaign_notifications_failed}
        />
        <StatCard label="Campaign Success" value={`${campaignSuccessRate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Panel title="Notification Categories">
          <div className="space-y-4">
            <MetricRow
              label="Order"
              value={safeSummary.order_notifications}
              total={safeSummary.total_notifications}
            />
            <MetricRow
              label="Delivery"
              value={safeSummary.delivery_notifications}
              total={safeSummary.total_notifications}
            />
            <MetricRow
              label="Refund"
              value={safeSummary.refund_notifications}
              total={safeSummary.total_notifications}
            />
            <MetricRow
              label="Loyalty & Rewards"
              value={safeSummary.loyalty_notifications}
              total={safeSummary.total_notifications}
            />
            <MetricRow
              label="Wishlist"
              value={safeSummary.wishlist_notifications}
              total={safeSummary.total_notifications}
            />
            <MetricRow
              label="Marketing/Coupon"
              value={safeSummary.marketing_notifications}
              total={safeSummary.total_notifications}
            />
          </div>
        </Panel>

        <Panel title="Campaign Breakdown">
          <div className="space-y-4">
            <MetricRow
              label="Coupon Campaigns"
              value={safeCampaignAnalytics.coupon_campaigns}
              total={safeCampaignAnalytics.total_campaigns}
            />
            <MetricRow
              label="Marketing Campaigns"
              value={safeCampaignAnalytics.marketing_campaigns}
              total={safeCampaignAnalytics.total_campaigns}
            />
            <MetricRow
              label="Sent Campaigns"
              value={safeCampaignAnalytics.sent_campaigns}
              total={safeCampaignAnalytics.total_campaigns}
            />
            <MetricRow
              label="Failed Campaigns"
              value={safeCampaignAnalytics.failed_campaigns}
              total={safeCampaignAnalytics.total_campaigns}
            />
          </div>
        </Panel>

        <Panel title="Recent Activity">
          <div className="space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Notifications last 7 days</span>
              <span className="font-semibold">
                {safeSummary.notifications_last_7_days}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Campaigns last 7 days</span>
              <span className="font-semibold">
                {safeCampaignAnalytics.campaigns_last_7_days}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">High priority alerts</span>
              <span className="font-semibold">
                {safeSummary.high_priority_notifications}
              </span>
            </div>

            <div className="border-t pt-4">
              <p className="text-slate-500">Last notification</p>
              <p className="font-medium mt-1">
                {safeSummary.last_notification_at
                  ? new Date(
                      safeSummary.last_notification_at
                    ).toLocaleString()
                  : "None yet"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Last campaign</p>
              <p className="font-medium mt-1">
                {safeCampaignAnalytics.last_campaign_sent_at
                  ? new Date(
                      safeCampaignAnalytics.last_campaign_sent_at
                    ).toLocaleString()
                  : "None yet"}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Top Notification Types">
        {typeAnalytics.length === 0 ? (
          <p className="text-slate-500">No notification data yet.</p>
        ) : (
          <div className="space-y-4">
            {typeAnalytics.map((item) => (
              <div
                key={`${item.type}-${item.channel}-${item.priority}`}
                className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs capitalize">
                      {formatLabel(item.type)}
                    </span>

                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">
                      {item.channel}
                    </span>

                    <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs capitalize">
                      {item.priority}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-3">
                    Last sent:{" "}
                    {item.last_sent_at
                      ? new Date(item.last_sent_at).toLocaleString()
                      : "Never"}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <MiniStat label="Total" value={item.total_count} />
                  <MiniStat label="Read" value={item.read_count} />
                  <MiniStat label="30 Days" value={item.count_last_30_days} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Recent Campaigns">
        {campaigns.length === 0 ? (
          <p className="text-slate-500">No campaigns sent yet.</p>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs capitalize">
                      {formatLabel(campaign.type)}
                    </span>

                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">
                      {formatLabel(campaign.audience)}
                    </span>

                    <span
                      className={`px-3 py-1 rounded-full text-xs capitalize ${
                        campaign.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : campaign.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {campaign.status}
                    </span>
                  </div>

                  <h3 className="font-semibold mt-3">{campaign.title}</h3>

                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                    {campaign.message}
                  </p>

                  <p className="text-xs text-slate-400 mt-2">
                    Created {new Date(campaign.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="lg:text-right">
                  <p className="font-bold">
                    Sent: {Number(campaign.sent_count || 0)}
                  </p>

                  <p className="text-sm text-slate-500">
                    Failed: {Number(campaign.failed_count || 0)}
                  </p>

                  {campaign.sent_at && (
                    <p className="text-xs text-slate-400 mt-2">
                      Sent {new Date(campaign.sent_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
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

function MetricRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm mb-2">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold">
          {value} ({percent}%)
        </span>
      </div>

      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-black rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}