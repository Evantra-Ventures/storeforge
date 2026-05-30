"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  product:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
  variant:
    | {
        id: string;
        name: string;
        option_name: string;
        option_value: string;
        sku: string | null;
      }
    | {
        id: string;
        name: string;
        option_name: string;
        option_value: string;
        sku: string | null;
      }[]
    | null;
};

type Order = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  subtotal_amount: number | null;
  discount_amount: number | null;
  coupon_code: string | null;
  refunded_amount: number | null;
  refund_status: string | null;
  total_amount: number;
  status: string | null;
  payment_status: string | null;
  created_at: string;
  order_items?: OrderItem[];
};

export default function OrdersPage() {
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const getProduct = (item: OrderItem) =>
    Array.isArray(item.product) ? item.product[0] : item.product;

  const getVariant = (item: OrderItem) =>
    Array.isArray(item.variant) ? item.variant[0] : item.variant;

  const getPaymentBadgeClass = (paymentStatus: string | null) => {
    switch (paymentStatus) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "refunded":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const getOrderStatusBadgeClass = (status: string | null) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getRefundBadgeClass = (refundStatus: string | null) => {
    switch (refundStatus) {
      case "partial":
        return "bg-orange-100 text-orange-700";
      case "full":
        return "bg-purple-100 text-purple-700";
      case "failed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        console.error(profileError);
        return;
      }

      setTenantId(profile.tenant_id);

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            product:products (
              id,
              name
            ),
            variant:product_variants (
              id,
              name,
              option_name,
              option_value,
              sku
            )
          )
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setOrders(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    if (!tenantId) return;

    try {
      setUpdatingId(orderId);

      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId)
        .eq("tenant_id", tenantId);

      if (error) {
        console.error(error);
        return;
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status } : order
        )
      );
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="text-slate-500 mt-2">
          Manage customer orders, variants, payments, refunds, and fulfillment.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Recent Orders</h2>

          <span className="text-sm text-slate-500">
            {orders.length} order(s)
          </span>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No orders yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="border rounded-2xl p-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold">
                        Order #{order.id.slice(0, 8)}
                      </p>

                      <span
                        className={`px-3 py-1 rounded-full text-xs capitalize ${getOrderStatusBadgeClass(
                          order.status
                        )}`}
                      >
                        {order.status || "pending"}
                      </span>

                      {order.coupon_code && (
                        <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-700">
                          Coupon: {order.coupon_code}
                        </span>
                      )}

                      {order.refund_status && order.refund_status !== "none" && (
                        <span
                          className={`px-3 py-1 rounded-full text-xs capitalize ${getRefundBadgeClass(
                            order.refund_status
                          )}`}
                        >
                          Refund: {order.refund_status}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-500 mt-2">
                      {order.customer_name || "Customer"} ·{" "}
                      {order.customer_email || "No email"}
                    </p>

                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm capitalize ${getPaymentBadgeClass(
                        order.payment_status
                      )}`}
                    >
                      {order.payment_status || "pending"}
                    </span>

                    <select
                      value={order.status || "pending"}
                      onChange={(e) =>
                        updateOrderStatus(order.id, e.target.value)
                      }
                      disabled={updatingId === order.id}
                      className="border rounded-xl px-3 py-2 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <div className="text-right">
                      {Number(order.discount_amount || 0) > 0 && (
                        <p className="text-xs text-green-700">
                          Discount: -GHS{" "}
                          {Number(order.discount_amount || 0).toFixed(2)}
                        </p>
                      )}

                      {Number(order.refunded_amount || 0) > 0 && (
                        <p className="text-xs text-purple-700">
                          Refunded: -GHS{" "}
                          {Number(order.refunded_amount || 0).toFixed(2)}
                        </p>
                      )}

                      <p className="text-xl font-bold">
                        GHS {Number(order.total_amount).toFixed(2)}
                      </p>
                    </div>

                    <a
                      href={`/orders/${order.id}`}
                      className="px-4 py-2 rounded-xl border text-sm hover:bg-slate-100 transition"
                    >
                      View
                    </a>
                  </div>
                </div>

                {order.order_items && order.order_items.length > 0 && (
                  <div className="mt-5 border-t pt-4">
                    <p className="text-sm font-medium mb-3">Items</p>

                    <div className="space-y-3">
                      {order.order_items.slice(0, 3).map((item) => {
                        const product = getProduct(item);
                        const variant = getVariant(item);

                        return (
                          <div
                            key={item.id}
                            className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-slate-50 rounded-xl p-3"
                          >
                            <div>
                              <p className="font-medium text-sm">
                                {product?.name || "Product"}
                              </p>

                              {variant && (
                                <p className="text-xs text-purple-700 mt-1">
                                  {variant.option_name}: {variant.option_value}
                                  {variant.sku ? ` · SKU: ${variant.sku}` : ""}
                                </p>
                              )}
                            </div>

                            <p className="text-sm text-slate-600">
                              Qty {item.quantity} × GHS{" "}
                              {Number(item.price).toFixed(2)}
                            </p>
                          </div>
                        );
                      })}

                      {order.order_items.length > 3 && (
                        <p className="text-xs text-slate-500">
                          +{order.order_items.length - 3} more item(s)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}