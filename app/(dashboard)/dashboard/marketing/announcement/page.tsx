"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Coupon = {
  id: string;
  code: string;
  discount_type: string | null;
  discount_value: number | null;
  status: string;
  starts_at?: string | null;
  ends_at?: string | null;
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
    description: "Customers who opted into email, SMS, or WhatsApp marketing.",
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
        .select("id,code,discount_type,discount_value,status,starts_at,ends_at")
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

    if (!actionUrl) {
      setActionUrl("");
    }
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
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Customer Announcements</h1>
          <p className="text-slate-500 mt-2">
            Send coupon alerts and announcements to customers as in-app
            notifications. Customer notification preferences are respected
            automatically.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <a
            href="/dashboard/marketing/notification-analytics"
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Notification Analytics
          </a>

          <button
            onClick={fetchData}
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

      {successMessage && (
        <div className="bg-green-100 text-green-700 p-4 rounded-xl">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <StatCard label="Campaigns" value={stats.totalCampaigns} />
        <StatCard label="Sent Campaigns" value={stats.sentCampaigns} />
        <StatCard label="Failed Campaigns" value={stats.failedCampaigns} />
        <StatCard label="Customers Notified" value={stats.totalSent} />
        <StatCard label="Failed Sends" value={stats.totalFailed} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <section className="xl:col-span-2 bg-white rounded-2xl shadow p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Create Announcement</h2>
            <p className="text-sm text-slate-500 mt-1">
              Compose a customer notification campaign. Right now this sends
              in-app notifications only.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="border rounded-xl p-3 w-full"
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
                className="border rounded-xl p-3 w-full"
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
                className="border rounded-xl p-3 w-full"
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
                className="border rounded-xl p-3 w-full"
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="bg-slate-50 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="font-semibold">{selectedCoupon.code}</p>
                <p className="text-sm text-slate-500">
                  {formatCouponDiscount(selectedCoupon)} ·{" "}
                  {selectedCoupon.status}
                </p>

                {(selectedCoupon.starts_at || selectedCoupon.ends_at) && (
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedCoupon.starts_at
                      ? `Starts ${new Date(
                          selectedCoupon.starts_at
                        ).toLocaleDateString()}`
                      : "No start date"}
                    {" · "}
                    {selectedCoupon.ends_at
                      ? `Ends ${new Date(
                          selectedCoupon.ends_at
                        ).toLocaleDateString()}`
                      : "No end date"}
                  </p>
                )}
              </div>

              <button
                onClick={fillCouponTemplate}
                className="border px-4 py-2 rounded-xl text-sm hover:bg-white"
              >
                Use Coupon Template
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={fillMarketingTemplate}
              className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
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
              className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
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
              className="w-full border rounded-xl p-3"
            />
            <p className="text-xs text-slate-400 mt-1">
              {title.length}/120 characters
            </p>
          </Field>

          <Field label="Message">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the notification message customers will see..."
              maxLength={500}
              className="w-full border rounded-xl p-3 min-h-[130px]"
            />
            <p className="text-xs text-slate-400 mt-1">
              {message.length}/500 characters
            </p>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Action URL Optional">
              <input
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/store/my-shop"
                className="border rounded-xl p-3 w-full"
              />
            </Field>

            <Field label="Image URL Optional">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="border rounded-xl p-3 w-full"
              />
            </Field>
          </div>

          <button
            onClick={handleSend}
            disabled={sending}
            className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Announcement"}
          </button>
        </section>

        <aside className="bg-white rounded-2xl shadow p-6 h-fit xl:sticky xl:top-8">
          <h2 className="text-xl font-semibold">Preview</h2>
          <p className="text-sm text-slate-500 mt-1">
            This is how the notification may appear to customers.
          </p>

          <div className="border rounded-2xl p-4 mt-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs capitalize">
                {formatLabel(type)}
              </span>

              <span
                className={`px-3 py-1 rounded-full text-xs capitalize ${
                  priority === "urgent" || priority === "high"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {priority}
              </span>
            </div>

            {imageUrl && (
              <div className="mt-4 rounded-2xl overflow-hidden bg-slate-100 aspect-video">
                <img
                  src={imageUrl}
                  alt="Announcement preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <h3 className="font-semibold mt-4">
              {title || "Announcement title"}
            </h3>

            <p className="text-sm text-slate-600 mt-2">
              {message ||
                "Your announcement message will appear here before sending."}
            </p>

            {actionUrl && (
              <p className="text-xs text-blue-600 mt-3">
                Action: {actionUrl}
              </p>
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 mt-5 text-sm text-slate-600 space-y-2">
            <p>
              <span className="font-medium text-slate-900">Preference check:</span>{" "}
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

      <section className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold">Recent Campaigns</h2>
            <p className="text-sm text-slate-500 mt-1">
              Last 50 customer notification campaigns.
            </p>
          </div>

          <button
            onClick={fetchData}
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center text-slate-500 py-10">
            No campaigns sent yet.
          </div>
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
    <div className="bg-white rounded-2xl shadow p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="text-3xl font-bold mt-2">{value}</h2>
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
      <label className="block text-sm font-medium mb-2">{label}</label>
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
    <div className="border rounded-2xl p-4 bg-slate-50">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
    </div>
  );
}