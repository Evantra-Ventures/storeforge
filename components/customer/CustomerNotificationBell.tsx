"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  tenant_id: string;
  type: string;
  title: string;
  message: string;
  action_url: string | null;
  priority: string;
  status: string;
  created_at: string;
  tenant_name?: string | null;
};

export default function CustomerNotificationBell({
  tenantId,
}: {
  tenantId?: string | null;
}) {
  const supabase = createClient();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => item.status === "unread").length;
  }, [notifications]);

  const formatType = (value: string) => value.replaceAll("_", " ");

  const getTypeClass = (type: string) => {
    switch (type) {
      case "payment_confirmed":
      case "order_processing":
      case "order_completed":
        return "bg-blue-100 text-blue-700";
      case "delivered":
      case "loyalty_points_earned":
      case "reward_redeemed":
        return "bg-green-100 text-green-700";
      case "refund_processed":
      case "loyalty_points_reversed":
        return "bg-purple-100 text-purple-700";
      case "wishlist_back_in_stock":
      case "wishlist_price_drop":
        return "bg-indigo-100 text-indigo-700";
      case "coupon_available":
      case "marketing":
        return "bg-pink-100 text-pink-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setNotifications([]);
        return;
      }

      setUserId(user.id);

      let query = supabase
        .from("customer_notification_summary")
        .select(
          `
          id,
          tenant_id,
          type,
          title,
          message,
          action_url,
          priority,
          status,
          created_at,
          tenant_name
        `
        )
        .eq("user_id", user.id)
        .eq("status", "unread")
        .order("created_at", { ascending: false })
        .limit(8);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query;

      if (error) {
        console.error(error);
        return;
      }

      setNotifications(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const markRead = async (notificationId: string) => {
    if (!userId) return;

    try {
      setUpdatingId(notificationId);

      const { error } = await supabase.rpc("mark_customer_notification_read", {
        p_notification_id: notificationId,
        p_user_id: userId,
      });

      if (error) {
        console.error(error);
        return;
      }

      setNotifications((current) =>
        current.filter((item) => item.id !== notificationId)
      );
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  const markAllRead = async () => {
    if (!userId) return;

    try {
      setUpdatingId("all");

      const { error } = await supabase.rpc(
        "mark_all_customer_notifications_read",
        {
          p_user_id: userId,
          p_tenant_id: tenantId || null,
        }
      );

      if (error) {
        console.error(error);
        return;
      }

      setNotifications([]);
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
      >
        Notifications

        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs min-w-5 h-5 px-1 rounded-full flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(24rem,90vw)] bg-white border rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-xs text-slate-500">
                {unreadCount} unread notification(s)
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={updatingId === "all"}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                {updatingId === "all" ? "Updating..." : "Mark all read"}
              </button>
            )}
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="font-medium">No unread notifications</p>
                <p className="text-sm text-slate-500 mt-1">
                  New updates will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div key={notification.id} className="p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] capitalize ${getTypeClass(
                          notification.type
                        )}`}
                      >
                        {formatType(notification.type)}
                      </span>

                      {notification.priority === "high" ||
                      notification.priority === "urgent" ? (
                        <span className="px-2 py-1 rounded-full text-[11px] bg-orange-100 text-orange-700 capitalize">
                          {notification.priority}
                        </span>
                      ) : null}
                    </div>

                    <h4 className="font-semibold text-sm mt-3">
                      {notification.title}
                    </h4>

                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                      {notification.message}
                    </p>

                    <div className="flex items-center justify-between gap-3 mt-3">
                      <p className="text-xs text-slate-400">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>

                      <div className="flex items-center gap-2">
                        {notification.action_url && (
                          <a
                            href={notification.action_url}
                            onClick={() => markRead(notification.id)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Open
                          </a>
                        )}

                        <button
                          onClick={() => markRead(notification.id)}
                          disabled={updatingId === notification.id}
                          className="text-xs text-slate-500 hover:text-black disabled:opacity-50"
                        >
                          {updatingId === notification.id
                            ? "Updating..."
                            : "Mark read"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-slate-50">
            <a
              href="/customer/notifications"
              className="block text-center text-sm font-medium hover:underline"
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  );
}