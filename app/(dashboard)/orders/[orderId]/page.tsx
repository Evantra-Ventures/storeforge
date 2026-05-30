"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  shipping_zone_id: string | null;
  shipping_full_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_region: string | null;
  shipping_area: string | null;
  shipping_note: string | null;
  shipping_fee: number | null;
  delivery_method: string | null;
  delivery_status: string | null;
  total_amount: number;
  status: string | null;
  payment_status: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  product: {
    id: string;
    name: string;
    image_url: string | null;
  } | null;
  variant: {
    id: string;
    name: string;
    option_name: string;
    option_value: string;
    image_url: string | null;
    sku: string | null;
  } | null;
};

export default function OrderDetailPage() {
  const supabase = createClient();
  const params = useParams();

  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updatingDelivery, setUpdatingDelivery] = useState(false);

  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const formatMoney = (amount: number) => `GHS ${amount.toFixed(2)}`;

  const formatStatus = (value: string | null) =>
    (value || "pending").replaceAll("_", " ");

  const getOrderNotificationContent = (status: string) => {
    switch (status) {
      case "processing":
        return {
          type: "order_processing",
          title: "Order is processing",
          message: `Your order #${orderId.slice(
            0,
            8
          )} is now being processed.`,
          priority: "normal",
        };

      case "completed":
        return {
          type: "order_completed",
          title: "Order completed",
          message: `Your order #${orderId.slice(0, 8)} has been completed.`,
          priority: "normal",
        };

      case "cancelled":
        return {
          type: "delivery_update",
          title: "Order cancelled",
          message: `Your order #${orderId.slice(0, 8)} has been cancelled.`,
          priority: "high",
        };

      default:
        return {
          type: "delivery_update",
          title: "Order status updated",
          message: `Your order #${orderId.slice(
            0,
            8
          )} status is now ${formatStatus(status)}.`,
          priority: "normal",
        };
    }
  };

  const getDeliveryNotificationContent = (deliveryStatus: string) => {
    switch (deliveryStatus) {
      case "preparing":
        return {
          type: "delivery_update",
          title: "Order is being prepared",
          message: `Your order #${orderId.slice(
            0,
            8
          )} is being prepared for delivery or pickup.`,
          priority: "normal",
        };

      case "out_for_delivery":
        return {
          type: "out_for_delivery",
          title: "Order is out for delivery",
          message: `Your order #${orderId.slice(
            0,
            8
          )} is now out for delivery.`,
          priority: "high",
        };

      case "delivered":
        return {
          type: "delivered",
          title: "Order delivered",
          message: `Your order #${orderId.slice(0, 8)} has been delivered.`,
          priority: "normal",
        };

      case "failed":
        return {
          type: "delivery_update",
          title: "Delivery failed",
          message: `Delivery for order #${orderId.slice(
            0,
            8
          )} was marked as failed. Please contact the store for support.`,
          priority: "high",
        };

      case "returned":
        return {
          type: "delivery_update",
          title: "Order returned",
          message: `Order #${orderId.slice(
            0,
            8
          )} has been marked as returned.`,
          priority: "high",
        };

      default:
        return {
          type: "delivery_update",
          title: "Delivery status updated",
          message: `Delivery status for order #${orderId.slice(
            0,
            8
          )} is now ${formatStatus(deliveryStatus)}.`,
          priority: "normal",
        };
    }
  };

  const createStatusNotification = async ({
    currentOrder,
    changeType,
    previousValue,
    newValue,
  }: {
    currentOrder: Order;
    changeType: "order_status" | "delivery_status";
    previousValue: string | null;
    newValue: string;
  }) => {
    if (!currentOrder.customer_id) return;

    const content =
      changeType === "order_status"
        ? getOrderNotificationContent(newValue)
        : getDeliveryNotificationContent(newValue);

    try {
      await supabase.rpc("create_customer_notification", {
        p_tenant_id: currentOrder.tenant_id,
        p_user_id: currentOrder.customer_id,
        p_type: content.type,
        p_title: content.title,
        p_message: content.message,
        p_channel: "in_app",
        p_priority: content.priority,
        p_entity_type: "order",
        p_entity_id: currentOrder.id,
        p_order_id: currentOrder.id,
        p_action_url: `/order-success/${currentOrder.id}`,
        p_metadata: {
          idempotency_key: `${content.type}:${currentOrder.id}:${changeType}:${newValue}`,
          order_id: currentOrder.id,
          change_type: changeType,
          previous_value: previousValue,
          new_value: newValue,
        },
      });
    } catch (notificationError) {
      console.error("Customer notification error:", notificationError);
    }
  };

  const createStatusAuditLog = async ({
    currentOrder,
    changeType,
    previousValue,
    newValue,
  }: {
    currentOrder: Order;
    changeType: "order_status" | "delivery_status";
    previousValue: string | null;
    newValue: string;
  }) => {
    try {
      await supabase.from("audit_logs").insert({
        tenant_id: currentOrder.tenant_id,
        actor_id: adminUserId,
        action:
          changeType === "order_status"
            ? "order_status_update"
            : "delivery_status_update",
        entity_type: "order",
        entity_id: currentOrder.id,
        severity:
          newValue === "cancelled" || newValue === "failed" || newValue === "returned"
            ? "warning"
            : "info",
        description:
          changeType === "order_status"
            ? `Order #${currentOrder.id.slice(
                0,
                8
              )} status changed from ${formatStatus(
                previousValue
              )} to ${formatStatus(newValue)}.`
            : `Order #${currentOrder.id.slice(
                0,
                8
              )} delivery status changed from ${formatStatus(
                previousValue
              )} to ${formatStatus(newValue)}.`,
        metadata: {
          order_id: currentOrder.id,
          change_type: changeType,
          previous_value: previousValue,
          new_value: newValue,
          customer_id: currentOrder.customer_id,
        },
      });
    } catch (auditError) {
      console.error("Status audit log error:", auditError);
    }
  };

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setAdminUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return;

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("tenant_id", profile.tenant_id)
        .single();

      if (orderError || !orderData) {
        console.error(orderError);
        setErrorMessage("Order not found.");
        return;
      }

      setOrder(orderData);

      const { data: orderItemsData, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          id,
          quantity,
          price,
          product:products (
            id,
            name,
            image_url
          ),
          variant:product_variants (
            id,
            name,
            option_name,
            option_value,
            image_url,
            sku
          )
        `)
        .eq("order_id", orderData.id);

      if (itemsError) {
        console.error(itemsError);
        setErrorMessage(itemsError.message);
        return;
      }

      const formattedItems: OrderItem[] = (orderItemsData || []).map(
        (item: any) => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          product: Array.isArray(item.product)
            ? item.product[0]
            : item.product,
          variant: item.variant
            ? Array.isArray(item.variant)
              ? item.variant[0]
              : item.variant
            : null,
        })
      );

      setItems(formattedItems);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load order.");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!order) return;

    const previousStatus = order.status || "pending";

    if (previousStatus === status) return;

    try {
      setUpdating(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("orders")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("tenant_id", order.tenant_id);

      if (error) {
        console.error(error);
        setErrorMessage(error.message);
        return;
      }

      await createStatusNotification({
        currentOrder: order,
        changeType: "order_status",
        previousValue: previousStatus,
        newValue: status,
      });

      await createStatusAuditLog({
        currentOrder: order,
        changeType: "order_status",
        previousValue: previousStatus,
        newValue: status,
      });

      setOrder({ ...order, status });
      setSuccessMessage("Order status updated and customer notified.");
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update order status.");
    } finally {
      setUpdating(false);
    }
  };

  const updateDeliveryStatus = async (deliveryStatus: string) => {
    if (!order) return;

    const previousDeliveryStatus = order.delivery_status || "pending";

    if (previousDeliveryStatus === deliveryStatus) return;

    try {
      setUpdatingDelivery(true);
      setErrorMessage("");
      setSuccessMessage("");

      const nextOrderStatus =
        deliveryStatus === "delivered"
          ? "completed"
          : deliveryStatus === "failed" || deliveryStatus === "returned"
          ? order.status
          : order.status;

      const updatePayload: Record<string, string> = {
        delivery_status: deliveryStatus,
        updated_at: new Date().toISOString(),
      };

      if (deliveryStatus === "delivered" && order.status !== "completed") {
        updatePayload.status = "completed";
      }

      const { error } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", order.id)
        .eq("tenant_id", order.tenant_id);

      if (error) {
        console.error(error);
        setErrorMessage(error.message);
        return;
      }

      await createStatusNotification({
        currentOrder: order,
        changeType: "delivery_status",
        previousValue: previousDeliveryStatus,
        newValue: deliveryStatus,
      });

      await createStatusAuditLog({
        currentOrder: order,
        changeType: "delivery_status",
        previousValue: previousDeliveryStatus,
        newValue: deliveryStatus,
      });

      if (deliveryStatus === "delivered" && order.status !== "completed") {
        await createStatusNotification({
          currentOrder: order,
          changeType: "order_status",
          previousValue: order.status,
          newValue: "completed",
        });

        await createStatusAuditLog({
          currentOrder: order,
          changeType: "order_status",
          previousValue: order.status,
          newValue: "completed",
        });
      }

      setOrder({
        ...order,
        delivery_status: deliveryStatus,
        status: nextOrderStatus || order.status,
      });

      setSuccessMessage("Delivery status updated and customer notified.");
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update delivery status.");
    } finally {
      setUpdatingDelivery(false);
    }
  };

  const handleRefund = async () => {
    if (!order) return;

    const confirmed = confirm("Are you sure you want to request this refund?");
    if (!confirmed) return;

    try {
      setRefunding(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch("/api/paystack/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          amount: refundAmount ? Number(refundAmount) : undefined,
          reason: refundReason || "Refund requested by store admin.",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Refund failed.");
        return;
      }

      setSuccessMessage("Refund requested successfully.");

      setRefundAmount("");
      setRefundReason("");

      fetchOrder();
    } catch (error) {
      console.error(error);
      setErrorMessage("Refund request failed.");
    } finally {
      setRefunding(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p className="text-slate-500">Loading order...</p>;
  }

  if (!order) {
    return (
      <div className="bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <p className="text-slate-500 mt-2">
          This order does not exist or does not belong to your store.
        </p>

        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl mt-6">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  const calculatedSubtotal = items.reduce((acc, item) => {
    return acc + Number(item.price) * Number(item.quantity);
  }, 0);

  const subtotal = Number(order.subtotal_amount ?? calculatedSubtotal);
  const discountAmount = Number(order.discount_amount || 0);
  const refundedAmount = Number(order.refunded_amount || 0);
  const shippingFee = Number(order.shipping_fee || 0);
  const remainingRefundable = Number(order.total_amount) - refundedAmount;

  const canRefund =
    order.payment_status === "paid" &&
    remainingRefundable > 0 &&
    order.refund_status !== "full";

  return (
    <div className="space-y-8">
      <div>
        <a href="/orders" className="text-sm text-slate-500 hover:text-black">
          ← Back to Orders
        </a>

        <h1 className="text-3xl font-bold mt-4">
          Order #{order.id.slice(0, 8)}
        </h1>

        <p className="text-slate-500 mt-2">
          Placed on {new Date(order.created_at).toLocaleString()}
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Order Items</h2>

            {items.length === 0 ? (
              <p className="text-slate-500">No items found.</p>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const imageUrl =
                    item.variant?.image_url || item.product?.image_url;

                  return (
                    <div
                      key={item.id}
                      className="border rounded-2xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.product?.name || "Product"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-slate-400">
                              No Image
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-semibold">
                            {item.product?.name || "Deleted product"}
                          </h3>

                          {item.variant && (
                            <p className="text-sm text-purple-700 mt-1">
                              {item.variant.option_name}:{" "}
                              {item.variant.option_value}
                            </p>
                          )}

                          {item.variant?.sku && (
                            <p className="text-xs text-slate-400 mt-1">
                              SKU: {item.variant.sku}
                            </p>
                          )}

                          <p className="text-sm text-slate-500 mt-1">
                            Qty: {item.quantity} ×{" "}
                            {formatMoney(Number(item.price))}
                          </p>
                        </div>
                      </div>

                      <p className="font-bold">
                        {formatMoney(Number(item.price) * item.quantity)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Customer</h2>

            <p className="font-medium">
              {order.shipping_full_name || order.customer_name || "Customer"}
            </p>

            <p className="text-slate-500">
              {order.customer_email || "No email"}
            </p>

            <p className="text-slate-500">
              {order.shipping_phone || "No phone"}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Shipping</h2>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500">Delivery Method</p>
                <p className="font-medium capitalize">
                  {order.delivery_method || "delivery"}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Delivery Status</p>
                <p className="font-medium capitalize">
                  {formatStatus(order.delivery_status)}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Delivery Area</p>
                <p className="font-medium">
                  {[
                    order.shipping_area,
                    order.shipping_city,
                    order.shipping_region,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Not provided"}
                </p>
              </div>

              {order.delivery_method === "delivery" && (
                <div>
                  <p className="text-slate-500">Address</p>
                  <p className="font-medium">
                    {order.shipping_address || "Not provided"}
                  </p>
                </div>
              )}

              {order.shipping_note && (
                <div>
                  <p className="text-slate-500">Note</p>
                  <p className="font-medium">{order.shipping_note}</p>
                </div>
              )}

              <div>
                <p className="text-slate-500">Shipping Fee</p>
                <p className="font-medium">{formatMoney(shippingFee)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow p-6 sticky top-8">
            <h2 className="text-xl font-semibold mb-6">Summary</h2>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Order Status</span>
                <span className="font-medium capitalize">
                  {formatStatus(order.status)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Delivery Status</span>
                <span className="font-medium capitalize">
                  {formatStatus(order.delivery_status)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Payment</span>
                <span className="font-medium capitalize">
                  {order.payment_status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Refund Status</span>
                <span className="font-medium capitalize">
                  {order.refund_status || "none"}
                </span>
              </div>

              <div className="border-t pt-4 flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">{formatMoney(subtotal)}</span>
              </div>

              {order.coupon_code && (
                <div className="flex justify-between text-green-700">
                  <span>Coupon</span>
                  <span className="font-medium">{order.coupon_code}</span>
                </div>
              )}

              {discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span className="font-medium">
                    -{formatMoney(discountAmount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-500">Shipping</span>
                <span className="font-medium">{formatMoney(shippingFee)}</span>
              </div>

              {refundedAmount > 0 && (
                <div className="flex justify-between text-purple-700">
                  <span>Refunded</span>
                  <span className="font-medium">
                    -{formatMoney(refundedAmount)}
                  </span>
                </div>
              )}

              <div className="border-t pt-4 flex justify-between text-base">
                <span className="text-slate-500">Total</span>
                <span className="font-bold">
                  {formatMoney(Number(order.total_amount))}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Refundable</span>
                <span className="font-medium">
                  {formatMoney(remainingRefundable)}
                </span>
              </div>
            </div>

            <div className="border-t my-6" />

            <label className="block text-sm font-medium mb-2">
              Update Order Status
            </label>

            <select
              value={order.status || "pending"}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={updating}
              className="w-full border rounded-xl px-3 py-3"
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <label className="block text-sm font-medium mb-2 mt-5">
              Update Delivery Status
            </label>

            <select
              value={order.delivery_status || "pending"}
              onChange={(e) => updateDeliveryStatus(e.target.value)}
              disabled={updatingDelivery}
              className="w-full border rounded-xl px-3 py-3"
            >
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="returned">Returned</option>
            </select>

            <div className="border-t my-6" />

            <h3 className="font-semibold mb-4">Refund</h3>

            {!canRefund ? (
              <p className="text-sm text-slate-500">
                This order is not refundable or has already been fully refunded.
              </p>
            ) : (
              <div className="space-y-3">
                <input
                  type="number"
                  min="0"
                  max={remainingRefundable}
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={`Amount up to ${remainingRefundable.toFixed(2)}`}
                  className="w-full border rounded-xl p-3"
                />

                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason for refund"
                  className="w-full border rounded-xl p-3 min-h-[90px]"
                />

                <button
                  onClick={handleRefund}
                  disabled={refunding}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {refunding ? "Processing Refund..." : "Request Refund"}
                </button>

                <p className="text-xs text-slate-500">
                  Leave amount empty to refund the remaining full amount.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}