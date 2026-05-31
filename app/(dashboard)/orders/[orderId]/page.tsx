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

function formatStatus(value: string | null) {
  return (value || "pending").replaceAll("_", " ");
}

function statusClass(value: string | null) {
  const status = value || "pending";

  if (["paid", "completed", "delivered"].includes(status)) {
    return "bg-green-100 text-green-700";
  }

  if (["processing", "preparing", "out_for_delivery"].includes(status)) {
    return "bg-blue-100 text-blue-700";
  }

  if (["failed", "cancelled", "returned", "full"].includes(status)) {
    return "bg-red-100 text-red-700";
  }

  if (["refunded", "partial"].includes(status)) {
    return "bg-purple-100 text-purple-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

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

  const formatMoney = (amount: number) => `GHS ${Number(amount || 0).toFixed(2)}`;

  const getOrderNotificationContent = (status: string) => {
    switch (status) {
      case "processing":
        return {
          type: "order_processing",
          title: "Order is processing",
          message: `Your order #${orderId.slice(0, 8)} is now being processed.`,
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
          message: `Order #${orderId.slice(0, 8)} has been marked as returned.`,
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
          newValue === "cancelled" ||
          newValue === "failed" ||
          newValue === "returned"
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
        deliveryStatus === "delivered" ? "completed" : order.status;

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
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-500">Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Order not found</h1>
        <p className="mt-2 text-slate-500">
          This order does not exist or does not belong to your store.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
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
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%)]" />

        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
          <div className="lg:col-span-2">
            <a
              href="/orders"
              className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/15"
            >
              ← Back to orders
            </a>

            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Order #{order.id.slice(0, 8)}
            </h1>

            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Manage fulfillment, update customer-facing statuses, trigger
              in-app notifications, review order items, and process refunds.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <StatusBadge
                label={formatStatus(order.status)}
                className={statusClass(order.status)}
              />
              <StatusBadge
                label={`Payment: ${formatStatus(order.payment_status)}`}
                className={statusClass(order.payment_status)}
              />
              <StatusBadge
                label={`Delivery: ${formatStatus(order.delivery_status)}`}
                className={statusClass(order.delivery_status)}
              />

              {order.refund_status && order.refund_status !== "none" && (
                <StatusBadge
                  label={`Refund: ${formatStatus(order.refund_status)}`}
                  className={statusClass(order.refund_status)}
                />
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white p-4 text-slate-950 shadow-2xl">
            <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
              <p className="text-sm text-slate-300">Order total</p>
              <h2 className="mt-2 text-4xl font-bold">
                {formatMoney(Number(order.total_amount))}
              </h2>

              <div className="mt-6 space-y-3">
                <HeroMiniRow
                  label="Placed"
                  value={new Date(order.created_at).toLocaleDateString()}
                />
                <HeroMiniRow
                  label="Items"
                  value={`${items.length}`}
                />
                <HeroMiniRow
                  label="Refundable"
                  value={formatMoney(remainingRefundable)}
                />
              </div>
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

      <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatCard label="Order status" value={formatStatus(order.status)} />
        <StatCard
          label="Payment status"
          value={formatStatus(order.payment_status)}
        />
        <StatCard
          label="Delivery status"
          value={formatStatus(order.delivery_status)}
        />
        <StatCard label="Refund status" value={formatStatus(order.refund_status)} />
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Panel
            title="Order tracking"
            description="This timeline mirrors the customer-facing order tracking experience."
          >
            <OrderProgress
              paymentStatus={order.payment_status}
              orderStatus={order.status}
              deliveryStatus={order.delivery_status}
            />
          </Panel>

          <Panel title="Order items" description="Products included in this order.">
            {items.length === 0 ? (
              <EmptyState text="No items found." />
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const imageUrl =
                    item.variant?.image_url || item.product?.image_url;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.product?.name || "Product"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-slate-400">
                              No image
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="font-semibold text-slate-950">
                            {item.product?.name || "Deleted product"}
                          </h3>

                          {item.variant && (
                            <p className="mt-1 text-sm text-blue-700">
                              {item.variant.option_name}:{" "}
                              {item.variant.option_value}
                            </p>
                          )}

                          {item.variant?.sku && (
                            <p className="mt-1 text-xs text-slate-400">
                              SKU: {item.variant.sku}
                            </p>
                          )}

                          <p className="mt-1 text-sm text-slate-500">
                            Qty {item.quantity} ×{" "}
                            {formatMoney(Number(item.price))}
                          </p>
                        </div>
                      </div>

                      <p className="text-lg font-bold text-slate-950">
                        {formatMoney(Number(item.price) * item.quantity)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <Panel title="Customer" description="Customer contact information.">
              <InfoStack
                rows={[
                  {
                    label: "Name",
                    value:
                      order.shipping_full_name ||
                      order.customer_name ||
                      "Customer",
                  },
                  {
                    label: "Email",
                    value: order.customer_email || "No email",
                  },
                  {
                    label: "Phone",
                    value: order.shipping_phone || "No phone",
                  },
                ]}
              />
            </Panel>

            <Panel title="Shipping" description="Delivery and address details.">
              <InfoStack
                rows={[
                  {
                    label: "Method",
                    value: formatStatus(order.delivery_method || "delivery"),
                  },
                  {
                    label: "Status",
                    value: formatStatus(order.delivery_status),
                  },
                  {
                    label: "Area",
                    value:
                      [
                        order.shipping_area,
                        order.shipping_city,
                        order.shipping_region,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Not provided",
                  },
                  {
                    label: "Address",
                    value:
                      order.delivery_method === "delivery"
                        ? order.shipping_address || "Not provided"
                        : "Pickup order",
                  },
                  {
                    label: "Note",
                    value: order.shipping_note || "No note",
                  },
                  {
                    label: "Shipping fee",
                    value: formatMoney(shippingFee),
                  },
                ]}
              />
            </Panel>
          </div>
        </div>

        <aside className="space-y-8">
          <Panel className="lg:sticky lg:top-28" title="Control center">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Update order status
                </label>

                <select
                  value={order.status || "pending"}
                  onChange={(e) => updateStatus(e.target.value)}
                  disabled={updating}
                  className="field-input"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <p className="mt-2 text-xs text-slate-500">
                  Changing this sends an in-app customer notification.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Update delivery status
                </label>

                <select
                  value={order.delivery_status || "pending"}
                  onChange={(e) => updateDeliveryStatus(e.target.value)}
                  disabled={updatingDelivery}
                  className="field-input"
                >
                  <option value="pending">Pending</option>
                  <option value="preparing">Preparing</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="returned">Returned</option>
                </select>

                <p className="mt-2 text-xs text-slate-500">
                  Delivery changes also create audit logs and customer alerts.
                </p>
              </div>
            </div>

            <div className="my-6 border-t border-slate-200" />

            <h3 className="mb-4 font-semibold text-slate-950">Refund</h3>

            {!canRefund ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                This order is not refundable or has already been fully refunded.
              </div>
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
                  className="field-input"
                />

                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason for refund"
                  className="field-input min-h-[100px]"
                />

                <button
                  onClick={handleRefund}
                  disabled={refunding}
                  className="w-full rounded-2xl bg-red-600 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {refunding ? "Processing refund..." : "Request refund"}
                </button>

                <p className="text-xs text-slate-500">
                  Leave amount empty to refund the remaining full amount.
                </p>
              </div>
            )}
          </Panel>

          <Panel title="Payment summary">
            <div className="space-y-4 text-sm">
              <SummaryRow label="Subtotal" value={formatMoney(subtotal)} />

              {order.coupon_code && (
                <SummaryRow label="Coupon" value={order.coupon_code} success />
              )}

              {discountAmount > 0 && (
                <SummaryRow
                  label="Discount"
                  value={`-${formatMoney(discountAmount)}`}
                  success
                />
              )}

              <SummaryRow label="Shipping" value={formatMoney(shippingFee)} />

              {refundedAmount > 0 && (
                <SummaryRow
                  label="Refunded"
                  value={`-${formatMoney(refundedAmount)}`}
                  warning
                />
              )}

              <div className="flex justify-between border-t border-slate-200 pt-4 text-base">
                <span className="font-bold text-slate-950">Total</span>
                <span className="font-bold text-slate-950">
                  {formatMoney(Number(order.total_amount))}
                </span>
              </div>

              <SummaryRow
                label="Refundable"
                value={formatMoney(remainingRefundable)}
              />
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-2 text-xl font-bold capitalize text-slate-950">
        {value}
      </h2>
    </div>
  );
}

function StatusBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${className}`}
    >
      {label}
    </span>
  );
}

function HeroMiniRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function InfoStack({
  rows,
}: {
  rows: {
    label: string;
    value: string;
  }[];
}) {
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {row.label}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  success,
  warning,
}: {
  label: string;
  value: string;
  success?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${
        success
          ? "text-green-700"
          : warning
          ? "text-purple-700"
          : "text-slate-600"
      }`}
    >
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function OrderProgress({
  paymentStatus,
  orderStatus,
  deliveryStatus,
}: {
  paymentStatus: string | null;
  orderStatus: string | null;
  deliveryStatus: string | null;
}) {
  const paid = paymentStatus === "paid" || paymentStatus === "refunded";
  const processing = ["processing", "completed"].includes(orderStatus || "");
  const outForDelivery = ["out_for_delivery", "delivered"].includes(
    deliveryStatus || ""
  );
  const delivered = deliveryStatus === "delivered";

  const steps = [
    {
      label: "Paid",
      complete: paid,
    },
    {
      label: "Processing",
      complete: processing,
    },
    {
      label: "Out for delivery",
      complete: outForDelivery,
    },
    {
      label: "Delivered",
      complete: delivered,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      {steps.map((step, index) => (
        <div
          key={step.label}
          className={`rounded-2xl border p-4 ${
            step.complete
              ? "border-green-200 bg-green-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div
            className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
              step.complete
                ? "bg-green-600 text-white"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {step.complete ? "✓" : index + 1}
          </div>

          <p
            className={`text-sm font-semibold ${
              step.complete ? "text-green-800" : "text-slate-500"
            }`}
          >
            {step.label}
          </p>
        </div>
      ))}
    </div>
  );
}