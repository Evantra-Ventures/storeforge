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

    const formatType = (value: string) => value.replaceAll("_", " ");

    const getNotificationTone = (notification: Notification) => {
        if (notification.status === "read") {
            return "bg-slate-50 border-slate-200";
        }

        switch (notification.priority) {
            case "urgent":
                return "bg-red-50 border-red-200";
            case "high":
                return "bg-orange-50 border-orange-200";
            case "low":
                return "bg-slate-50 border-slate-200";
            default:
                return "bg-white border-slate-200";
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
                <p className="text-slate-500">Loading notifications...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b">
                <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-5">
                    <a href="/" className="text-2xl font-bold">
                        StoreForge
                    </a>

                    <div className="flex items-center gap-4 flex-wrap justify-end">
                        <a href="/" className="text-sm text-slate-500 hover:text-black">
                            Continue Shopping
                        </a>

                        <a
                            href="/my-orders"
                            className="text-sm text-slate-500 hover:text-black"
                        >
                            My Orders
                        </a>

                        <a
                            href="/customer/loyalty"
                            className="text-sm text-slate-500 hover:text-black"
                        >
                            My Rewards
                        </a>

                        <a
                            href="/customer/profile"
                            className="text-sm text-slate-500 hover:text-black"
                        >
                            My Profile
                        </a>
                        <a
                            href="/customer/notification-settings"
                            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
                        >
                            Notification Settings
                        </a>

                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                    <div>
                        <h1 className="text-4xl font-bold">Notifications</h1>
                        <p className="text-slate-500 mt-2">
                            Track your order updates, refunds, rewards, coupons, wishlist
                            alerts, and account messages.
                        </p>
                    </div>

                    <button
                        onClick={handleMarkAllRead}
                        disabled={updatingId === "all" || stats.unread === 0}
                        className="bg-black text-white px-5 py-3 rounded-xl text-sm disabled:opacity-50"
                    >
                        {updatingId === "all" ? "Updating..." : "Mark All Read"}
                    </button>
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
                    <StatCard label="Total" value={stats.total} />
                    <StatCard label="Unread" value={stats.unread} />
                    <StatCard label="Read" value={stats.read} />
                    <StatCard label="Dismissed" value={stats.dismissed} />
                    <StatCard label="Urgent" value={stats.urgent} />
                </div>

                <div className="bg-white rounded-3xl border p-6 space-y-5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold">Filter Notifications</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Showing {filteredNotifications.length} of{" "}
                                {notifications.length} notification(s)
                            </p>
                        </div>

                        <button
                            onClick={resetFilters}
                            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
                        >
                            Reset
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search notifications..."
                            className="border rounded-xl p-3"
                        />

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border rounded-xl p-3"
                        >
                            <option value="">All statuses</option>
                            <option value="unread">Unread</option>
                            <option value="read">Read</option>
                            <option value="dismissed">Dismissed</option>
                        </select>

                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="border rounded-xl p-3"
                        >
                            <option value="">All types</option>

                            {notificationTypes.map((type) => (
                                <option key={type} value={type}>
                                    {formatType(type)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <section className="lg:col-span-2 space-y-4">
                        {filteredNotifications.length === 0 ? (
                            <div className="bg-white rounded-3xl border p-16 text-center">
                                <h2 className="text-2xl font-bold">No notifications found</h2>
                                <p className="text-slate-500 mt-3">
                                    Your notifications will appear here.
                                </p>
                            </div>
                        ) : (
                            filteredNotifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`border rounded-3xl p-5 ${getNotificationTone(
                                        notification
                                    )}`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs capitalize ${getTypeBadge(
                                                        notification.type
                                                    )}`}
                                                >
                                                    {formatType(notification.type)}
                                                </span>

                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs capitalize ${getStatusBadge(
                                                        notification.status
                                                    )}`}
                                                >
                                                    {notification.status}
                                                </span>

                                                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">
                                                    {notification.priority}
                                                </span>
                                            </div>

                                            <h3 className="font-semibold text-lg mt-3">
                                                {notification.title}
                                            </h3>

                                            <p className="text-sm text-slate-600 mt-2">
                                                {notification.message}
                                            </p>

                                            <div className="flex items-center gap-3 flex-wrap text-xs text-slate-400 mt-3">
                                                <span>
                                                    {new Date(notification.created_at).toLocaleString()}
                                                </span>

                                                {notification.tenant_name && (
                                                    <span>Store: {notification.tenant_name}</span>
                                                )}

                                                {notification.order_id && (
                                                    <span>
                                                        Order #{notification.order_id.slice(0, 8)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {notification.image_url && (
                                            <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden">
                                                <img
                                                    src={notification.image_url}
                                                    alt={notification.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3 mt-5">
                                        {notification.action_url && (
                                            <a
                                                href={notification.action_url}
                                                onClick={() => {
                                                    if (notification.status === "unread") {
                                                        handleMarkRead(notification.id);
                                                    }
                                                }}
                                                className="bg-black text-white px-4 py-3 rounded-xl text-sm text-center hover:opacity-90"
                                            >
                                                Open
                                            </a>
                                        )}

                                        {notification.status === "unread" && (
                                            <button
                                                onClick={() => handleMarkRead(notification.id)}
                                                disabled={updatingId === notification.id}
                                                className="border px-4 py-3 rounded-xl text-sm hover:bg-slate-100 disabled:opacity-50"
                                            >
                                                {updatingId === notification.id
                                                    ? "Updating..."
                                                    : "Mark Read"}
                                            </button>
                                        )}

                                        {notification.status !== "dismissed" && (
                                            <button
                                                onClick={() => handleDismiss(notification.id)}
                                                disabled={updatingId === notification.id}
                                                className="border px-4 py-3 rounded-xl text-sm hover:bg-slate-100 disabled:opacity-50"
                                            >
                                                Dismiss
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </section>

                    <aside className="bg-white rounded-3xl border p-6 h-fit lg:sticky lg:top-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold">
                                Notification Preferences
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">
                                Choose which updates you want to receive.
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

                                <div className="border-t pt-5 space-y-3">
                                    <h3 className="font-semibold">Channels</h3>

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

                                <button
                                    onClick={handleSavePreferences}
                                    disabled={savingPreferences}
                                    className="w-full bg-black text-white py-3 rounded-xl text-sm disabled:opacity-50"
                                >
                                    {savingPreferences ? "Saving..." : "Save Preferences"}
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
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div className="bg-white rounded-3xl border p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <h2 className="text-3xl font-bold mt-2">{value}</h2>
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
        <label className="flex items-center justify-between gap-4 border rounded-xl p-3">
            <span className="text-sm font-medium">{label}</span>

            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
            />
        </label>
    );
}