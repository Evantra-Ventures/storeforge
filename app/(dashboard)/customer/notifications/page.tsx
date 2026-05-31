"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  tenant_id: string;
  customer_profile_id: string;
  user_id: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  order_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  coupon_id: string | null;
  loyalty_transaction_id: string | null;
  reward_redemption_id: string | null;
  action_url: string | null;
  image_url: string | null;
  priority: string;
  status: string;
  sent_at: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  tenant_name: string;
  tenant_slug: string;
};

type Preferences = {
  id: string;
  tenant_id: string;
  customer_profile_id: string;
  user_id: string;

  order_updates_enabled: boolean;
  delivery_updates_enabled: boolean;
  refund_updates_enabled: boolean;
  loyalty_updates_enabled: boolean;
  reward_updates_enabled: boolean;
  coupon_updates_enabled: boolean;
  wishlist_updates_enabled: boolean;
  marketing_updates_enabled: boolean;

  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;

  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;

  status: string;
};

export default function CustomerNotificationsPage() {
  const supabase = createClient();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const formatType = (value: string) =>
    value.replaceAll("_", " ").replaceAll(".", " ");

  const getNotificationTone = (notification: Notification) => {
    if (notification.status === "read") {
      return "bg-white border-slate-200";
    }

    switch (notification.priority) {
      case "urgent":
        return "bg-red-50 border-red-200";
      case "high":
        return "bg-orange-50 border-orange-200";
      case "low":
        return "bg-slate-50 border-slate-200";
      default:
        return "bg-white border-blue-100";
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "payment_confirmed":
      case "order_processing":
      case "order_completed":
      case "order_placed":
        return "bg-blue-100 text-blue-700";
      case "delivered":
      case "loyalty_points_earned":
      case "reward_redeemed":
        return "bg-green-100 text-green-700";
      case "refund_processed":
      case "loyalty_points_reversed":
        return "bg-purple-100 text-purple-700";
      case "out_for_delivery":
      case "delivery_update":
        return "bg-yellow-100 text-yellow-700";
      case "coupon_available":
        return "bg-pink-100 text-pink-700";
      case "wishlist_back_in_stock":
      case "wishlist_price_drop":
        return "bg-indigo-100 text-indigo-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "unread":
        return "bg-green-100 text-green-700";
      case "read":
        return "bg-slate-100 text-slate-700";
      case "dismissed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "low":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const getIcon = (type: string) => {
    if (type.includes("delivery") || type.includes("out_for_delivery")) {
      return "🚚";
    }

    if (type.includes("order") || type.includes("payment")) {
      return "🛍️";
    }

    if (type.includes("refund")) {
      return "↩️";
    }

    if (type.includes("loyalty") || type.includes("reward")) {
      return "⭐";
    }

    if (type.includes("coupon")) {
      return "🎟️";
    }

    if (type.includes("wishlist")) {
      return "💙";
    }

    return "🔔";
  };

  const fetchNotifications = async () => {
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

      setUserId(user.id);

      const { data: profileData } = await supabase
        .from("customer_profiles")
        .select("id, tenant_id, user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!profileData) {
        setErrorMessage("Customer profile not found.");
        return;
      }

      setTenantId(profileData.tenant_id);

      await supabase.rpc("ensure_customer_notification_preferences", {
        p_tenant_id: profileData.tenant_id,
        p_customer_profile_id: profileData.id,
        p_user_id: user.id,
      });

      const { data: preferencesData, error: preferencesError } = await supabase
        .from("customer_notification_preferences")
        .select("*")
        .eq("tenant_id", profileData.tenant_id)
        .eq("customer_profile_id", profileData.id)
        .maybeSingle();

      if (preferencesError) {
        setErrorMessage(preferencesError.message);
        return;
      }

      setPreferences(preferencesData || null);

      const { data: notificationsData, error: notificationsError } =
        await supabase
          .from("customer_notification_summary")
          .select("*")
          .eq("user_id", user.id)
          .neq("status", "archived")
          .order("created_at", { ascending: false })
          .limit(100);

      if (notificationsError) {
        setErrorMessage(notificationsError.message);
        return;
      }

      setNotifications(notificationsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const matchesStatus =
        !statusFilter || notification.status === statusFilter;

      const matchesType = !typeFilter || notification.type === typeFilter;

      const matchesSearch =
        !searchTerm ||
        [
          notification.title,
          notification.message,
          notification.type,
          notification.tenant_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [notifications, statusFilter, typeFilter, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: notifications.length,
      unread: notifications.filter((item) => item.status === "unread").length,
      read: notifications.filter((item) => item.status === "read").length,
      dismissed: notifications.filter((item) => item.status === "dismissed")
        .length,
      urgent: notifications.filter((item) => item.priority === "urgent").length,
    };
  }, [notifications]);

  const notificationTypes = useMemo(() => {
    return Array.from(new Set(notifications.map((item) => item.type))).sort();
  }, [notifications]);

  const recentUnread = notifications
    .filter((item) => item.status === "unread")
    .slice(0, 3);

  const handleMarkRead = async (notificationId: string) => {
    if (!userId) return;

    try {
      setUpdatingId(notificationId);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc("mark_customer_notification_read", {
        p_notification_id: notificationId,
        p_user_id: userId,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                status: "read",
                read_at: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to mark notification as read.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;

    try {
      setUpdatingId("all");
      setErrorMessage("");
      setSuccessMessage("");

      const { data, error } = await supabase.rpc(
        "mark_all_customer_notifications_read",
        {
          p_user_id: userId,
          p_tenant_id: tenantId,
        }
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          item.status === "unread"
            ? {
                ...item,
                status: "read",
                read_at: new Date().toISOString(),
              }
            : item
        )
      );

      setSuccessMessage(`${Number(data || 0)} notification(s) marked as read.`);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to mark all notifications as read.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    if (!userId) return;

    try {
      setUpdatingId(notificationId);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc("dismiss_customer_notification", {
        p_notification_id: notificationId,
        p_user_id: userId,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                status: "dismissed",
                dismissed_at: new Date().toISOString(),
              }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to dismiss notification.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePreferenceChange = (field: keyof Preferences, value: boolean) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      [field]: value,
    });
  };

  const handleSavePreferences = async () => {
    if (!preferences || !userId) return;

    try {
      setSavingPreferences(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("customer_notification_preferences")
        .update({
          order_updates_enabled: preferences.order_updates_enabled,
          delivery_updates_enabled: preferences.delivery_updates_enabled,
          refund_updates_enabled: preferences.refund_updates_enabled,
          loyalty_updates_enabled: preferences.loyalty_updates_enabled,
          reward_updates_enabled: preferences.reward_updates_enabled,
          coupon_updates_enabled: preferences.coupon_updates_enabled,
          wishlist_updates_enabled: preferences.wishlist_updates_enabled,
          marketing_updates_enabled: preferences.marketing_updates_enabled,

          email_enabled: preferences.email_enabled,
          sms_enabled: preferences.sms_enabled,
          whatsapp_enabled: preferences.whatsapp_enabled,
          in_app_enabled: preferences.in_app_enabled,

          quiet_hours_enabled: preferences.quiet_hours_enabled,
          quiet_hours_start: preferences.quiet_hours_start,
          quiet_hours_end: preferences.quiet_hours_end,

          updated_at: new Date().toISOString(),
        })
        .eq("id", preferences.id)
        .eq("user_id", userId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Notification preferences saved.");
      fetchNotifications();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to save preferences.");
    } finally {
      setSavingPreferences(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setTypeFilter("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-slate-500">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <a href="/" className="text-2xl font-bold tracking-tight">
            StoreForge
          </a>

          <div className="flex flex-wrap items-center gap-4">
            <a href="/" className="text-sm text-slate-500 hover:text-slate-950">
              Continue Shopping
            </a>

            <a
              href="/my-orders"
              className="text-sm text-slate-500 hover:text-slate-950"
            >
              My Orders
            </a>

            <a
              href="/customer/loyalty"
              className="text-sm text-slate-500 hover:text-slate-950"
            >
              My Rewards
            </a>

            <a
              href="/customer/profile"
              className="text-sm text-slate-500 hover:text-slate-950"
            >
              My Profile
            </a>

            <a
              href="/customer/notification-settings"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Settings
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.25),transparent_35%)]" />

          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
            <div className="lg:col-span-2">
              <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
                Customer notification center
              </div>

              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                Stay updated on orders, rewards, coupons, and wishlist alerts.
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
                Track every important customer update in one polished feed —
                from delivery progress and refund updates to loyalty points,
                rewards, coupons, and back-in-stock alerts.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={handleMarkAllRead}
                  disabled={updatingId === "all" || stats.unread === 0}
                  className="rounded-2xl bg-white px-6 py-4 font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-50"
                >
                  {updatingId === "all" ? "Updating..." : "Mark all as read"}
                </button>

                <a
                  href="/customer/loyalty"
                  className="rounded-2xl border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10"
                >
                  View rewards
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white p-4 text-slate-950 shadow-2xl">
              <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-300">Recent updates</p>
                    <h2 className="mt-1 text-2xl font-bold">
                      {stats.unread} unread
                    </h2>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    🔔
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {recentUnread.length === 0 ? (
                    <div className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">
                      You are all caught up.
                    </div>
                  ) : (
                    recentUnread.map((notification) => (
                      <div
                        key={notification.id}
                        className="rounded-2xl bg-white/10 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                            {getIcon(notification.type)}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {notification.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <a
                  href="#notification-feed"
                  className="mt-5 block rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-slate-200"
                >
                  Open feed
                </a>
              </div>
            </div>
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

        <section className="grid grid-cols-1 gap-5 md:grid-cols-5">
          <StatCard label="Total" value={stats.total} helper="All updates" />
          <StatCard label="Unread" value={stats.unread} helper="Needs review" />
          <StatCard label="Read" value={stats.read} helper="Seen updates" />
          <StatCard
            label="Dismissed"
            value={stats.dismissed}
            helper="Hidden updates"
          />
          <StatCard label="Urgent" value={stats.urgent} helper="High priority" />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Filters
              </p>

              <h2 className="mt-2 text-2xl font-bold">Find notifications</h2>

              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredNotifications.length} of {notifications.length}{" "}
                notification(s).
              </p>
            </div>

            <button
              onClick={resetFilters}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Reset filters
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search notifications..."
              className="field-input"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="field-input"
            >
              <option value="">All statuses</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="field-input"
            >
              <option value="">All types</option>

              {notificationTypes.map((type) => (
                <option key={type} value={type}>
                  {formatType(type)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section id="notification-feed" className="space-y-4 lg:col-span-2">
            {filteredNotifications.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                  🔔
                </div>

                <h2 className="text-2xl font-bold">No notifications found</h2>

                <p className="mt-3 text-slate-500">
                  Your notifications will appear here.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-3xl border p-5 shadow-sm ${getNotificationTone(
                    notification
                  )}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex flex-1 gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xl text-white">
                        {getIcon(notification.type)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs capitalize ${getTypeBadge(
                              notification.type
                            )}`}
                          >
                            {formatType(notification.type)}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs capitalize ${getStatusBadge(
                              notification.status
                            )}`}
                          >
                            {notification.status}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs capitalize ${getPriorityBadge(
                              notification.priority
                            )}`}
                          >
                            {notification.priority}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-bold text-slate-950">
                          {notification.title}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {notification.message}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span>
                            {new Date(notification.created_at).toLocaleString()}
                          </span>

                          {notification.tenant_name && (
                            <span>Store: {notification.tenant_name}</span>
                          )}

                          {notification.order_id && (
                            <span>Order #{notification.order_id.slice(0, 8)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {notification.image_url && (
                      <div className="h-20 w-20 overflow-hidden rounded-2xl bg-slate-100">
                        <img
                          src={notification.image_url}
                          alt={notification.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    {notification.action_url && (
                      <a
                        href={notification.action_url}
                        onClick={() => {
                          if (notification.status === "unread") {
                            handleMarkRead(notification.id);
                          }
                        }}
                        className="rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-medium text-white hover:bg-slate-800"
                      >
                        Open
                      </a>
                    )}

                    {notification.status === "unread" && (
                      <button
                        onClick={() => handleMarkRead(notification.id)}
                        disabled={updatingId === notification.id}
                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                      >
                        {updatingId === notification.id
                          ? "Updating..."
                          : "Mark read"}
                      </button>
                    )}

                    {notification.status !== "dismissed" && (
                      <button
                        onClick={() => handleDismiss(notification.id)}
                        disabled={updatingId === notification.id}
                        className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>

          <aside className="h-fit space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Preferences
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Notification settings
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Choose which updates and channels you want to receive.
              </p>
            </div>

            {!preferences ? (
              <p className="text-slate-500">Preferences unavailable.</p>
            ) : (
              <>
                <div className="space-y-3">
                  <PreferenceToggle
                    label="Order updates"
                    checked={preferences.order_updates_enabled}
                    onChange={(value) =>
                      handlePreferenceChange("order_updates_enabled", value)
                    }
                  />

                  <PreferenceToggle
                    label="Delivery updates"
                    checked={preferences.delivery_updates_enabled}
                    onChange={(value) =>
                      handlePreferenceChange("delivery_updates_enabled", value)
                    }
                  />

                  <PreferenceToggle
                    label="Refund updates"
                    checked={preferences.refund_updates_enabled}
                    onChange={(value) =>
                      handlePreferenceChange("refund_updates_enabled", value)
                    }
                  />

                  <PreferenceToggle
                    label="Loyalty updates"
                    checked={preferences.loyalty_updates_enabled}
                    onChange={(value) =>
                      handlePreferenceChange("loyalty_updates_enabled", value)
                    }
                  />

                  <PreferenceToggle
                    label="Reward updates"
                    checked={preferences.reward_updates_enabled}
                    onChange={(value) =>
                      handlePreferenceChange("reward_updates_enabled", value)
                    }
                  />

                  <PreferenceToggle
                    label="Coupon updates"
                    checked={preferences.coupon_updates_enabled}
                    onChange={(value) =>
                      handlePreferenceChange("coupon_updates_enabled", value)
                    }
                  />

                  <PreferenceToggle
                    label="Wishlist alerts"
                    checked={preferences.wishlist_updates_enabled}
                    onChange={(value) =>
                      handlePreferenceChange("wishlist_updates_enabled", value)
                    }
                  />

                  <PreferenceToggle
                    label="Marketing updates"
                    checked={preferences.marketing_updates_enabled}
                    onChange={(value) =>
                      handlePreferenceChange("marketing_updates_enabled", value)
                    }
                  />
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <h3 className="mb-3 font-semibold">Channels</h3>

                  <div className="space-y-3">
                    <PreferenceToggle
                      label="In-app"
                      checked={preferences.in_app_enabled}
                      onChange={(value) =>
                        handlePreferenceChange("in_app_enabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="Email"
                      checked={preferences.email_enabled}
                      onChange={(value) =>
                        handlePreferenceChange("email_enabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="SMS"
                      checked={preferences.sms_enabled}
                      onChange={(value) =>
                        handlePreferenceChange("sms_enabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="WhatsApp"
                      checked={preferences.whatsapp_enabled}
                      onChange={(value) =>
                        handlePreferenceChange("whatsapp_enabled", value)
                      }
                    />
                  </div>
                </div>

                <button
                  onClick={handleSavePreferences}
                  disabled={savingPreferences}
                  className="w-full rounded-2xl bg-slate-950 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingPreferences ? "Saving..." : "Save preferences"}
                </button>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-2 text-3xl font-bold text-slate-950">{value}</h2>
      <p className="mt-2 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
      <span className="text-sm font-medium text-slate-700">{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}