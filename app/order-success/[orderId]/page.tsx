import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type Props = {
  params: {
    orderId: string;
  };
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

  if (["failed", "cancelled", "returned"].includes(status)) {
    return "bg-red-100 text-red-700";
  }

  return "bg-yellow-100 text-yellow-700";
}

function money(currency: string, amount: number) {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

export default async function OrderSuccessPage({ params }: Props) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      tenant:tenants (
        id,
        name,
        slug,
        logo_url,
        currency
      )
    `)
    .eq("id", params.orderId)
    .eq("customer_id", user.id)
    .single();

  if (!order) notFound();

  const { data: orderItems } = await supabase
    .from("order_items")
    .select(`
      id,
      quantity,
      price,
      variant_id,
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
    .eq("order_id", order.id);

  const { data: loyaltyRedemption } = await supabase
    .from("loyalty_reward_redemptions")
    .select(`
      id,
      points_redeemed,
      discount_amount,
      free_shipping_applied,
      code,
      status,
      reward:loyalty_rewards (
        name,
        reward_type
      )
    `)
    .eq("order_id", order.id)
    .maybeSingle();

  const { data: earnedTransaction } = await supabase
    .from("loyalty_transactions")
    .select("points,status")
    .eq("order_id", order.id)
    .eq("type", "earned")
    .in("status", ["completed", "reversed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currency = order.currency || order.tenant?.currency || "GHS";

  const subtotal =
    order.subtotal_amount ??
    orderItems?.reduce((acc: number, item: any) => {
      return acc + Number(item.price) * Number(item.quantity);
    }, 0) ??
    Number(order.total_amount);

  const discountAmount = Number(order.discount_amount || 0);
  const shippingFee = Number(order.shipping_fee || 0);
  const totalAmount = Number(order.total_amount || 0);

  const loyaltyPointsRedeemed = Number(
    loyaltyRedemption?.points_redeemed || 0
  );

  const loyaltyDiscountAmount = Number(
    loyaltyRedemption?.discount_amount || 0
  );

  const couponDiscountAmount =
    order.coupon_code && discountAmount > loyaltyDiscountAmount
      ? discountAmount - loyaltyDiscountAmount
      : 0;

  const loyaltyPointsEarned =
    earnedTransaction?.status === "reversed"
      ? 0
      : Number(earnedTransaction?.points || 0);

  const deliveryLocation = [
    order.shipping_area,
    order.shipping_city,
    order.shipping_region,
  ]
    .filter(Boolean)
    .join(", ");

  const createdAt = order.created_at
    ? new Date(order.created_at).toLocaleString()
    : "Recently";

  const paidAt =
    order.payment_status === "paid"
      ? order.updated_at
        ? new Date(order.updated_at).toLocaleString()
        : createdAt
      : null;

  const trackingNumber = `SF${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <a
            href={`/store/${order.tenant?.slug}`}
            className="flex items-center gap-4"
          >
            {order.tenant?.logo_url ? (
              <img
                src={order.tenant.logo_url}
                alt={order.tenant.name}
                className="h-12 w-12 rounded-2xl border object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white">
                {order.tenant?.name?.slice(0, 1) || "S"}
              </div>
            )}

            <div>
              <p className="text-xl font-bold text-slate-950">
                {order.tenant?.name || "StoreForge"}
              </p>
              <p className="text-xs text-slate-500">Order confirmation</p>
            </div>
          </a>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href={`/store/${order.tenant?.slug}`}
              className="text-sm text-slate-500 hover:text-slate-950"
            >
              Continue shopping
            </a>

            <a
              href="/my-orders"
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              My orders
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 rounded-[2rem] border border-green-200 bg-green-50 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-600 text-2xl text-white">
                ✓
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                    Payment successful
                  </h1>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(
                      order.payment_status
                    )}`}
                  >
                    {formatStatus(order.payment_status)}
                  </span>
                </div>

                <p className="mt-2 max-w-2xl text-slate-600">
                  We’ve received your order. Your payment status is{" "}
                  <span className="font-semibold capitalize text-slate-950">
                    {formatStatus(order.payment_status)}
                  </span>{" "}
                  and your order is now{" "}
                  <span className="font-semibold capitalize text-slate-950">
                    {formatStatus(order.status)}
                  </span>
                  .
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
              <p className="text-xs text-slate-500">Order number</p>
              <p className="mt-1 text-xl font-bold text-slate-950">
                #{order.id.slice(0, 8)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section className="space-y-8 lg:col-span-2">
            <Panel>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-slate-950">
                      Order #{order.id.slice(0, 8)}
                    </h2>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(
                        order.status
                      )}`}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Placed {createdAt}
                  </p>
                </div>

                <a
                  href="/my-orders"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  View order history
                </a>
              </div>

              <div className="mt-8">
                <OrderTimeline
                  paymentStatus={order.payment_status}
                  orderStatus={order.status}
                  deliveryStatus={order.delivery_status}
                  createdAt={createdAt}
                  paidAt={paidAt}
                />
              </div>
            </Panel>

            {(loyaltyPointsRedeemed > 0 || loyaltyPointsEarned > 0) && (
              <Panel className="border-green-200 bg-green-50">
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
                      Loyalty rewards
                    </p>

                    <h2 className="mt-2 text-2xl font-bold text-green-950">
                      Rewards updated from this order
                    </h2>

                    <p className="mt-2 text-sm text-green-800">
                      Your loyalty activity has been applied to your account.
                    </p>
                  </div>

                  <a
                    href="/customer/loyalty"
                    className="rounded-xl bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                  >
                    View rewards
                  </a>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {loyaltyPointsRedeemed > 0 && (
                    <RewardCard
                      label="Points redeemed"
                      value={loyaltyPointsRedeemed.toLocaleString()}
                      helper={`Saved ${money(
                        currency,
                        loyaltyDiscountAmount
                      )} on this order.`}
                    />
                  )}

                  {loyaltyPointsEarned > 0 && (
                    <RewardCard
                      label="Points earned"
                      value={loyaltyPointsEarned.toLocaleString()}
                      helper="Added to your rewards balance."
                    />
                  )}
                </div>
              </Panel>
            )}

            <Panel>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">
                    Items purchased
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {orderItems?.length || 0} item(s) included in this order.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {orderItems?.map((item: any) => {
                  const product = Array.isArray(item.product)
                    ? item.product[0]
                    : item.product;

                  const variant = Array.isArray(item.variant)
                    ? item.variant[0]
                    : item.variant;

                  const imageUrl = variant?.image_url || product?.image_url;
                  const lineTotal = Number(item.price) * Number(item.quantity);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product?.name || "Product"}
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
                            {product?.name || "Product"}
                          </h3>

                          {variant && (
                            <p className="mt-1 text-sm text-blue-700">
                              {variant.option_name}: {variant.option_value}
                            </p>
                          )}

                          {variant?.sku && (
                            <p className="mt-1 text-xs text-slate-400">
                              SKU: {variant.sku}
                            </p>
                          )}

                          <p className="mt-1 text-sm text-slate-500">
                            Qty {item.quantity} ×{" "}
                            {money(currency, Number(item.price))}
                          </p>
                        </div>
                      </div>

                      <p className="text-lg font-bold text-slate-950">
                        {money(currency, lineTotal)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </section>

          <aside className="space-y-8">
            <Panel className="lg:sticky lg:top-28">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Payment summary
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Transaction and delivery details for your order.
                </p>
              </div>

              <div className="space-y-4">
                <InfoRow
                  label="Payment"
                  value={formatStatus(order.payment_status)}
                  badgeClass={statusClass(order.payment_status)}
                />

                <InfoRow
                  label="Order status"
                  value={formatStatus(order.status)}
                  badgeClass={statusClass(order.status)}
                />

                <InfoRow
                  label="Delivery"
                  value={formatStatus(order.delivery_status)}
                  badgeClass={statusClass(order.delivery_status)}
                />

                <InfoRow label="Tracking number" value={trackingNumber} />
                <InfoRow label="Placed on" value={createdAt} />

                {paidAt && <InfoRow label="Paid on" value={paidAt} />}
              </div>

              <div className="my-6 border-t border-slate-200" />

              <div className="space-y-3 text-sm">
                <SummaryRow
                  label="Subtotal"
                  value={money(currency, Number(subtotal))}
                />

                {couponDiscountAmount > 0 && (
                  <SummaryRow
                    label={`Coupon discount (${order.coupon_code})`}
                    value={`-${money(currency, couponDiscountAmount)}`}
                    success
                  />
                )}

                {loyaltyDiscountAmount > 0 && (
                  <SummaryRow
                    label={
                      loyaltyPointsRedeemed > 0
                        ? `Loyalty discount (${loyaltyPointsRedeemed.toLocaleString()} points)`
                        : "Loyalty discount"
                    }
                    value={`-${money(currency, loyaltyDiscountAmount)}`}
                    success
                  />
                )}

                {discountAmount > 0 &&
                  !order.coupon_code &&
                  loyaltyDiscountAmount <= 0 && (
                    <SummaryRow
                      label="Discount"
                      value={`-${money(currency, discountAmount)}`}
                      success
                    />
                  )}

                <SummaryRow label="Shipping" value={money(currency, shippingFee)} />

                <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-lg">
                  <span className="font-bold text-slate-950">Total paid</span>
                  <span className="font-bold text-slate-950">
                    {money(currency, totalAmount)}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3">
                <a
                  href={`/store/${order.tenant?.slug}`}
                  className="rounded-2xl bg-slate-950 px-5 py-4 text-center font-semibold text-white hover:bg-slate-800"
                >
                  Continue shopping
                </a>

                <a
                  href="/my-orders"
                  className="rounded-2xl border border-slate-200 px-5 py-4 text-center font-semibold hover:bg-slate-50"
                >
                  View my orders
                </a>
              </div>
            </Panel>

            <Panel>
              <h2 className="text-xl font-bold text-slate-950">
                Delivery details
              </h2>

              <div className="mt-5 space-y-4">
                <InfoRow
                  label="Method"
                  value={formatStatus(order.delivery_method || "delivery")}
                />

                <InfoRow
                  label="Recipient"
                  value={
                    order.shipping_full_name ||
                    order.customer_name ||
                    "Customer"
                  }
                />

                <InfoRow
                  label="Phone"
                  value={order.shipping_phone || "Not provided"}
                />

                {order.delivery_method === "delivery" && (
                  <>
                    <InfoRow
                      label="Delivery area"
                      value={deliveryLocation || "Not provided"}
                    />

                    <InfoRow
                      label="Address"
                      value={order.shipping_address || "Not provided"}
                    />
                  </>
                )}

                {order.shipping_note && (
                  <InfoRow label="Note" value={order.shipping_note} />
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  badgeClass,
}: {
  label: string;
  value: string;
  badgeClass?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>

      {badgeClass ? (
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badgeClass}`}
        >
          {value}
        </span>
      ) : (
        <span className="max-w-[220px] text-right font-medium capitalize text-slate-950">
          {value}
        </span>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        success ? "text-green-700" : "text-slate-600"
      }`}
    >
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function RewardCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-green-200 bg-white p-5">
      <p className="text-sm text-green-800">{label}</p>
      <p className="mt-1 text-3xl font-bold text-green-700">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function OrderTimeline({
  paymentStatus,
  orderStatus,
  deliveryStatus,
  createdAt,
  paidAt,
}: {
  paymentStatus: string | null;
  orderStatus: string | null;
  deliveryStatus: string | null;
  createdAt: string;
  paidAt: string | null;
}) {
  const paid = paymentStatus === "paid";
  const processing = ["processing", "completed"].includes(orderStatus || "");
  const shipped = ["out_for_delivery", "delivered"].includes(
    deliveryStatus || ""
  );
  const delivered = deliveryStatus === "delivered";

  const steps = [
    {
      label: "Paid",
      helper: paidAt || createdAt,
      complete: paid,
    },
    {
      label: "Processing",
      helper: processing ? "Your order is being prepared." : "Pending",
      complete: processing,
    },
    {
      label: "Shipped",
      helper: shipped ? "Your order is on the way." : "Waiting",
      complete: shipped,
    },
    {
      label: "Delivered",
      helper: delivered ? "Order delivered." : "Not yet delivered",
      complete: delivered,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {steps.map((step, index) => (
        <div key={step.label} className="relative">
          {index < steps.length - 1 && (
            <div className="absolute left-8 top-6 hidden h-px w-full bg-slate-200 md:block" />
          )}

          <div className="relative rounded-2xl border border-slate-200 bg-white p-4">
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                step.complete
                  ? "bg-green-600 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {step.complete ? "✓" : index + 1}
            </div>

            <p className="font-semibold text-slate-950">{step.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {step.helper}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}