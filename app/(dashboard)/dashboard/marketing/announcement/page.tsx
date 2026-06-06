"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Coupon = {
  id: string;
  code: string;
  discount_type: string | null;
  discount_value: number | null;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
};

type Campaign = {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  coupon_id: string | null;
  priority: string;
  action_url: string | null;
  image_url: string | null;
  sent_count: number;
  failed_count: number;
  status: string;
  sent_at: string | null;
  created_at: string;
};

const campaignTypes = [
  {
    value: "coupon_available",
    label: "Coupon Available",
    description: "Send customers a coupon or discount alert.",
  },
  {
    value: "marketing",
    label: "Marketing Announcement",
    description: "Send a general promotional message.",
  },
  {
    value: "system",
    label: "System Message",
    description: "Send an important store or account notice.",
  },
  {
    value: "account_update",
    label: "Account Update",
    description: "Send customer account-related updates.",
  },
];

const audienceOptions = [
  {
    value: "all_customers",
    label: "All Customers",
    description: "Send to every active customer profile.",
  },
  {
    value: "customers_with_orders",
    label: "Customers With Orders",
    description: "Only customers who have placed at least one order.",
  },
  {
    value: "loyalty_customers",
    label: "Loyalty Customers",
    description: "Customers with active loyalty accounts.",
  },
  {
    value: "wishlist_customers",
    label: "Wishlist Customers",
    description: "Customers who saved products to their wishlist.",
  },
  {
    value: "marketing_opted_in",
    label: "Marketing Opted In",
    description: "Customers who opted into marketing notifications.",
  },
];

const priorityOptions = [
  {
    value: "low",
    label: "Low",
    description: "Minor update or soft announcement.",
  },
  {
    value: "normal",
    label: "Normal",
    description: "Standard customer notification.",
  },
  {
    value: "high",
    label: "High",
    description: "Important update that can bypass quiet hours.",
  },
  {
    value: "urgent",
    label: "Urgent",
    description: "Critical update that can bypass quiet hours.",
  },
];

export default function CustomerAnnouncementsPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [actorId, setActorId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("coupon_available");
  const [audience, setAudience] = useState("all_customers");
  const [couponId, setCouponId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [actionUrl, setActionUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedCoupon = useMemo(() => {
    return coupons.find((coupon) => coupon.id === couponId) || null;
  }, [coupons, couponId]);

  const selectedType = useMemo(() => {
    return campaignTypes.find((item) => item.value === type);
  }, [type]);

  const selectedAudience = useMemo(() => {
    return audienceOptions.find((item) => item.value === audience);
  }, [audience]);

  const selectedPriority = useMemo(() => {
    return priorityOptions.find((item) => item.value === priority);
  }, [priority]);

  const stats = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const sentCampaigns = campaigns.filter(
      (campaign) => campaign.status === "sent"
    ).length;
    const failedCampaigns = campaigns.filter(
      (campaign) => campaign.status === "failed"
    ).length;
    const totalSent = campaigns.reduce(
      (sum, campaign) => sum + Number(campaign.sent_count || 0),
      0
    );
    const totalFailed = campaigns.reduce(
      (sum, campaign) => sum + Number(campaign.failed_count || 0),
      0
    );

    return {
      totalCampaigns,
      sentCampaigns,
      failedCampaigns,
      totalSent,
      totalFailed,
    };
  }, [campaigns]);

  const formatLabel = (value: string) => value.replaceAll("_", " ");

  const formatCouponDiscount = (coupon: Coupon) => {
    if (!coupon.discount_type) return "Discount";

    if (coupon.discount_type === "percentage") {
      return `${Number(coupon.discount_value || 0)}% off`;
    }

    return `${Number(coupon.discount_value || 0).toFixed(2)} off`;
  };

  const fetchData = async () => {
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

      setActorId(user.id);

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

      const { data: couponData, error: couponError } = await supabase
        .from("coupons")
        .select(
          "id,code,discount_type,discount_value,status,starts_at,expires_at"
        )
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (couponError) {
        setErrorMessage(couponError.message);
        return;
      }

      setCoupons(couponData || []);

      const { data: campaignData, error: campaignError } = await supabase
        .from("customer_notification_campaigns")
        .select(`
          id,
          title,
          message,
          type,
          audience,
          coupon_id,
          priority,
          action_url,
          image_url,
          sent_count,
          failed_count,
          status,
          sent_at,
          created_at
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (campaignError) {
        setErrorMessage(campaignError.message);
        return;
      }

      setCampaigns(campaignData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fillCouponTemplate = () => {
    const coupon = selectedCoupon;

    if (!coupon) {
      setErrorMessage("Select a coupon first.");
      return;
    }

    setErrorMessage("");
    setType("coupon_available");
    setPriority("normal");
    setTitle(`New coupon available: ${coupon.code}`);

    setMessage(
      `Use coupon code ${coupon.code} at checkout and enjoy ${formatCouponDiscount(
        coupon
      )}.`
    );
  };

  const fillMarketingTemplate = () => {
    setType("marketing");
    setPriority("normal");
    setTitle("New update from our store");
    setMessage(
      "We have new products, offers, and updates available. Visit our store to see what is new."
    );
  };

  const validate = () => {
    if (!tenantId || !actorId) {
      setErrorMessage("Tenant or user not found.");
      return false;
    }

    if (!title.trim()) {
      setErrorMessage("Title is required.");
      return false;
    }

    if (!message.trim()) {
      setErrorMessage("Message is required.");
      return false;
    }

    if (title.trim().length > 120) {
      setErrorMessage("Title should be 120 characters or fewer.");
      return false;
    }

    if (message.trim().length > 500) {
      setErrorMessage("Message should be 500 characters or fewer.");
      return false;
    }

    if (type === "coupon_available" && !couponId) {
      setErrorMessage("Select a coupon for coupon notifications.");
      return false;
    }

    if (actionUrl && !actionUrl.startsWith("/")) {
      setErrorMessage("Action URL should be an internal path starting with /.");
      return false;
    }

    return true;
  };

  const handleSend = async () => {
    try {
      setSending(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!validate() || !tenantId || !actorId) return;

      const confirmed = confirm(
        `Send this announcement to ${formatLabel(audience)} now?`
      );

      if (!confirmed) return;

      const { data, error } = await supabase.rpc(
        "send_customer_announcement_notification",
        {
          p_tenant_id: tenantId,
          p_actor_id: actorId,
          p_title: title.trim(),
          p_message: message.trim(),
          p_type: type,
          p_audience: audience,
          p_coupon_id: couponId || null,
          p_priority: priority,
          p_action_url: actionUrl || null,
          p_image_url: imageUrl || null,
          p_metadata: {
            source: "merchant_dashboard",
            created_from: "customer_announcements_page",
          },
        }
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const sentCount = Number(data?.sent_count || 0);
      const failedCount = Number(data?.failed_count || 0);
      const status = data?.status || "sent";

      setSuccessMessage(
        `Announcement ${status}. Sent to ${sentCount} customer(s). Failed: ${failedCount}.`
      );

      setTitle("");
      setMessage("");
      setCouponId("");
      setActionUrl("");
      setImageUrl("");
      setPriority("normal");
      setAudience("all_customers");
      setType("coupon_available");

      await fetchData();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to send announcement.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <p className="text-slate-500">Loading announcements...</p>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Customer Announcements
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Send coupon alerts and announcements to customers as in-app
            notifications. Customer notification preferences are respected
            automatically.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
          <a
            href="/dashboard/marketing/notification-analytics"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium hover:bg-slate-50"
          >
            Notification Analytics
          </a>

          <button
            onClick={fetchData}
            className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl bg-green-50 p-4 text-green-700">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Campaigns" value={stats.totalCampaigns} />
        <StatCard label="Sent Campaigns" value={stats.sentCampaigns} />
        <StatCard label="Failed Campaigns" value={stats.failedCampaigns} />
        <StatCard label="Customers Notified" value={stats.totalSent} />
        <StatCard label="Failed Sends" value={stats.totalFailed} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
          <div>
            <h2 className="text-xl font-semibold">Create Announcement</h2>
            <p className="mt-1 text-sm text-slate-500">
              Compose a customer notification campaign. Right now this sends
              in-app notifications only.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3"
              >
                {campaignTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Audience">
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3"
              >
                {audienceOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3"
              >
                {priorityOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Coupon">
              <select
                value={couponId}
                onChange={(e) => setCouponId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3"
              >
                <option value="">Select Coupon</option>
                {coupons.map((coupon) => (
                  <option key={coupon.id} value={coupon.id}>
                    {coupon.code} · {coupon.status}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <InfoCard
              title={selectedType?.label || "Type"}
              description={selectedType?.description || ""}
            />

            <InfoCard
              title={selectedAudience?.label || "Audience"}
              description={selectedAudience?.description || ""}
            />

            <InfoCard
              title={`${selectedPriority?.label || "Normal"} Priority`}
              description={selectedPriority?.description || ""}
            />
          </div>

          {selectedCoupon && (
            <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{selectedCoupon.code}</p>
                <p className="text-sm text-slate-500">
                  {formatCouponDiscount(selectedCoupon)} ·{" "}
                  {selectedCoupon.status}
                </p>

                {(selectedCoupon.starts_at || selectedCoupon.expires_at) && (
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedCoupon.starts_at
                      ? `Starts ${new Date(
                          selectedCoupon.starts_at
                        ).toLocaleDateString()}`
                      : "No start date"}
                    {" · "}
                    {selectedCoupon.expires_at
                      ? `Expires ${new Date(
                          selectedCoupon.expires_at
                        ).toLocaleDateString()}`
                      : "No expiry date"}
                  </p>
                )}
              </div>

              <button
                onClick={fillCouponTemplate}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                Use Coupon Template
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={fillMarketingTemplate}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Use Marketing Template
            </button>

            <button
              type="button"
              onClick={() => {
                setTitle("");
                setMessage("");
                setActionUrl("");
                setImageUrl("");
                setCouponId("");
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Clear Form
            </button>
          </div>

          <Field label="Announcement Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
              maxLength={120}
              className="w-full rounded-xl border border-slate-200 p-3"
            />
            <p className="mt-1 text-xs text-slate-400">
              {title.length}/120 characters
            </p>
          </Field>

          <Field label="Message">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the notification message customers will see..."
              maxLength={500}
              className="min-h-[130px] w-full rounded-xl border border-slate-200 p-3"
            />
            <p className="mt-1 text-xs text-slate-400">
              {message.length}/500 characters
            </p>
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Action URL Optional">
              <input
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/store/my-shop"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
            </Field>

            <Field label="Image URL Optional">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-200 p-3"
              />
            </Field>
          </div>

          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full rounded-xl bg-slate-950 px-6 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:w-fit"
          >
            {sending ? "Sending..." : "Send Announcement"}
          </button>
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-8">
          <h2 className="text-xl font-semibold">Preview</h2>
          <p className="mt-1 text-sm text-slate-500">
            This is how the notification may appear to customers.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs capitalize text-blue-700">
                {formatLabel(type)}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs capitalize ${
                  priority === "urgent" || priority === "high"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {priority}
              </span>
            </div>

            {imageUrl && (
              <div className="mt-4 aspect-video overflow-hidden rounded-2xl bg-slate-100">
                <img
                  src={imageUrl}
                  alt="Announcement preview"
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <h3 className="mt-4 font-semibold">
              {title || "Announcement title"}
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              {message ||
                "Your announcement message will appear here before sending."}
            </p>

            {actionUrl && (
              <p className="mt-3 text-xs text-blue-600">
                Action: {actionUrl}
              </p>
            )}
          </div>

          <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-900">
                Preference check:
              </span>{" "}
              customers who disabled this category will not receive it.
            </p>
            <p>
              <span className="font-medium text-slate-900">Quiet hours:</span>{" "}
              low/normal notifications may be skipped during quiet hours.
            </p>
            <p>
              <span className="font-medium text-slate-900">Channel:</span>{" "}
              currently in-app only.
            </p>
          </div>
        </aside>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Recent Campaigns</h2>
            <p className="mt-1 text-sm text-slate-500">
              Last 50 customer notification campaigns.
            </p>
          </div>

          <button
            onClick={fetchData}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            No campaigns sent yet.
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs capitalize text-blue-700">
                      {formatLabel(campaign.type)}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize text-slate-700">
                      {formatLabel(campaign.audience)}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs capitalize ${
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

                  <h3 className="mt-3 font-semibold">{campaign.title}</h3>

                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {campaign.message}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
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
                    <p className="mt-2 text-xs text-slate-400">
                      Sent {new Date(campaign.sent_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}