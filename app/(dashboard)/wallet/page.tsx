"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  currency: string | null;
  paystack_subaccount_code: string | null;
  payout_setup_status: string | null;
  platform_commission_percentage: number | null;
  payment_fee_bearer: "merchant" | "platform" | null;
};

type Wallet = {
  id: string;
  tenant_id: string;
  pending_balance: number;
  available_balance: number;
  platform_balance_due: number;
  lifetime_earnings: number;
  lifetime_payouts: number;
  lifetime_fees: number;
  lifetime_refunds: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

type PaymentSplit = {
  id: string;
  tenant_id: string;
  order_id: string;
  customer_id: string | null;
  currency: string;
  order_total: number;
  platform_commission_percentage: number;
  platform_fee_amount: number;
  merchant_gross_amount: number;
  merchant_net_estimate: number;
  payment_fee_bearer: "merchant" | "platform";
  paystack_subaccount_code: string | null;
  paystack_transaction_reference: string | null;
  paystack_transaction_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type MerchantTransaction = {
  id: string;
  tenant_id: string;
  wallet_id: string | null;
  order_id: string | null;
  payout_id: string | null;
  type: string;
  status: string;
  gross_amount: number;
  platform_fee_amount: number;
  payment_processor_fee_amount: number;
  net_amount: number;
  balance_type: string;
  description: string | null;
  reference: string | null;
  created_at: string;
};

type MerchantPayout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payout_method: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  momo_provider: string | null;
  momo_number: string | null;
  momo_name: string | null;
  requested_at: string;
  paid_at: string | null;
  rejected_at: string | null;
};

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "GHS").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "GHS";
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function maskValue(value: string | null) {
  if (!value) return "Not available";
  if (value.length <= 8) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getStatusClass(status: string) {
  switch (status) {
    case "active":
    case "completed":
    case "paid":
    case "approved":
    case "settled":
      return "bg-green-100 text-green-700";
    case "pending":
    case "initialized":
    case "processing":
    case "manual_review":
      return "bg-yellow-100 text-yellow-700";
    case "failed":
    case "rejected":
    case "cancelled":
    case "reversed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getTransactionTypeClass(type: string) {
  switch (type) {
    case "order_credit":
    case "pending_to_available":
      return "bg-green-100 text-green-700";
    case "platform_fee":
    case "processor_fee":
      return "bg-orange-100 text-orange-700";
    case "payout_request":
    case "payout_paid":
      return "bg-blue-100 text-blue-700";
    case "refund_deduction":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function WalletPage() {
  const supabase = createClient();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [transactions, setTransactions] = useState<MerchantTransaction[]>([]);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const currency = normalizeCurrency(tenant?.currency || wallet?.currency);

  const money = (amount: number, selectedCurrency = currency) =>
    `${normalizeCurrency(selectedCurrency)} ${Number(amount || 0).toFixed(2)}`;

  const settlementReady = Boolean(
    tenant?.paystack_subaccount_code && tenant?.payout_setup_status === "active"
  );

  const fetchWallet = async () => {
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
        .select("tenant_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile?.tenant_id) {
        setErrorMessage(profileError?.message || "Tenant profile not found.");
        return;
      }

      if (!["store_owner", "owner", "super_admin"].includes(profile.role || "")) {
        setErrorMessage("You do not have permission to view settlements.");
        return;
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select(`
          id,
          name,
          slug,
          currency,
          paystack_subaccount_code,
          payout_setup_status,
          platform_commission_percentage,
          payment_fee_bearer
        `)
        .eq("id", profile.tenant_id)
        .maybeSingle();

      if (tenantError || !tenantData) {
        setErrorMessage(tenantError?.message || "Store not found.");
        return;
      }

      setTenant(tenantData as Tenant);

      let { data: walletData, error: walletError } = await supabase
        .from("merchant_wallets")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      if (!walletData && !walletError) {
        const { error: ensureError } = await supabase.rpc(
          "ensure_merchant_wallet",
          {
            p_tenant_id: profile.tenant_id,
            p_currency: normalizeCurrency(tenantData.currency),
          }
        );

        if (!ensureError) {
          const { data: newWalletData } = await supabase
            .from("merchant_wallets")
            .select("*")
            .eq("tenant_id", profile.tenant_id)
            .maybeSingle();

          walletData = newWalletData;
        }
      }

      if (walletError) {
        console.error("Wallet load error:", walletError);
      }

      setWallet(walletData || null);

      const { data: splitsData, error: splitsError } = await supabase
        .from("payment_splits")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (splitsError) {
        setErrorMessage(splitsError.message);
        return;
      }

      setPaymentSplits((splitsData || []) as PaymentSplit[]);

      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("merchant_transactions")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .order("created_at", { ascending: false })
          .limit(30);

      if (transactionsError) {
        console.error("Merchant transactions load error:", transactionsError);
      }

      setTransactions(transactionsData || []);

      const { data: payoutsData, error: payoutsError } = await supabase
        .from("merchant_payouts")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (payoutsError) {
        console.error("Merchant payouts load error:", payoutsError);
      }

      setPayouts(payoutsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load settlements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const totalSales = paymentSplits.reduce(
      (acc, split) => acc + Number(split.order_total || 0),
      0
    );

    const totalPlatformFees = paymentSplits.reduce(
      (acc, split) => acc + Number(split.platform_fee_amount || 0),
      0
    );

    const totalMerchantGross = paymentSplits.reduce(
      (acc, split) => acc + Number(split.merchant_gross_amount || 0),
      0
    );

    const totalMerchantNetEstimate = paymentSplits.reduce(
      (acc, split) => acc + Number(split.merchant_net_estimate || 0),
      0
    );

    const initializedSettlements = paymentSplits
      .filter((split) => split.status === "initialized")
      .reduce((acc, split) => acc + Number(split.merchant_net_estimate || 0), 0);

    const processingSettlements = paymentSplits
      .filter((split) => split.status === "paid")
      .reduce((acc, split) => acc + Number(split.merchant_net_estimate || 0), 0);

    const settledAmount = paymentSplits
      .filter((split) => split.status === "settled")
      .reduce((acc, split) => acc + Number(split.merchant_net_estimate || 0), 0);

    const failedOrReviewAmount = paymentSplits
      .filter((split) =>
        ["failed", "reversed", "manual_review"].includes(split.status)
      )
      .reduce((acc, split) => acc + Number(split.merchant_net_estimate || 0), 0);

    const totalPendingPayouts = payouts
      .filter((payout) => payout.status === "pending")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const totalPaidPayouts = payouts
      .filter((payout) => payout.status === "paid")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const fallbackWalletCredits = transactions
      .filter((transaction) => transaction.type === "order_credit")
      .reduce((acc, transaction) => acc + Number(transaction.net_amount || 0), 0);

    const refundDeductions = transactions
      .filter((transaction) => transaction.type === "refund_deduction")
      .reduce((acc, transaction) => acc + Number(transaction.net_amount || 0), 0);

    return {
      totalSales,
      totalPlatformFees,
      totalMerchantGross,
      totalMerchantNetEstimate,
      initializedSettlements,
      processingSettlements,
      settledAmount,
      failedOrReviewAmount,
      totalPendingPayouts,
      totalPaidPayouts,
      fallbackWalletCredits,
      refundDeductions,
    };
  }, [paymentSplits, transactions, payouts]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-500">Loading settlements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%)]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              StoreForge merchant settlements
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
              Settlements
            </h1>

            <p className="mt-4 max-w-3xl text-slate-300">
              Track Paystack split settlements, StoreForge platform fees,
              merchant earnings, refunds, and fallback manual payouts.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <StatusBadge
                label="Paystack setup"
                value={
                  settlementReady
                    ? "Active"
                    : tenant?.payout_setup_status || "Not started"
                }
                active={settlementReady}
              />

              <StatusBadge
                label="Platform fee"
                value={`${Number(
                  tenant?.platform_commission_percentage || 5
                )}%`}
                active
              />

              <StatusBadge
                label="Fee bearer"
                value={
                  tenant?.payment_fee_bearer === "platform"
                    ? "StoreForge"
                    : "Merchant"
                }
                active
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="/settings/payout"
              className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Settlement Setup
            </a>

            <a
              href="/wallet/payouts"
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
              Manual Payouts
            </a>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {errorMessage}
        </div>
      )}

      {!tenant ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">Store not found</h2>
          <p className="mt-2 text-slate-500">
            Your merchant settlement dashboard could not be loaded.
          </p>
        </div>
      ) : (
        <>
          {!settlementReady && (
            <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 text-yellow-800">
              <p className="font-semibold">Settlement setup is not active</p>
              <p className="mt-1 text-sm leading-6">
                Customers cannot complete online Paystack checkout until your
                settlement setup is active. Add your country, bank details, and
                create your Paystack subaccount.
              </p>

              <a
                href="/settings/payout"
                className="mt-4 inline-block rounded-xl bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700"
              >
                Complete settlement setup
              </a>
            </div>
          )}

          {wallet && Number(wallet.platform_balance_due || 0) > 0 && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
              <p className="font-semibold">Platform balance due</p>
              <p className="mt-1 text-sm leading-6">
                Your store has{" "}
                <span className="font-bold">
                  {money(Number(wallet.platform_balance_due || 0))}
                </span>{" "}
                due to StoreForge because refund deductions exceeded your
                available wallet balance.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <StatCard
              label="Total Sales"
              value={money(summary.totalSales)}
              helper="Gross sales from split payments"
            />

            <StatCard
              label="Merchant Gross"
              value={money(summary.totalMerchantGross)}
              helper="After StoreForge platform fee"
            />

            <StatCard
              label="StoreForge Fees"
              value={money(summary.totalPlatformFees)}
              helper="Platform fees from split records"
            />

            <StatCard
              label="Net Estimate"
              value={money(summary.totalMerchantNetEstimate)}
              helper="Estimated merchant settlement"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <StatCard
              label="Initialized"
              value={money(summary.initializedSettlements)}
              helper="Payment started but not confirmed"
            />

            <StatCard
              label="Processing Settlement"
              value={money(summary.processingSettlements)}
              helper="Paid orders awaiting settlement"
            />

            <StatCard
              label="Settled"
              value={money(summary.settledAmount)}
              helper="Confirmed settled records"
            />

            <StatCard
              label="Manual Review"
              value={money(summary.failedOrReviewAmount)}
              helper="Failed, reversed, or needs review"
              tone={summary.failedOrReviewAmount > 0 ? "danger" : "normal"}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <StatCard
              label="Fallback Wallet"
              value={money(wallet?.available_balance || 0)}
              helper="Only for fallback/manual flows"
            />

            <StatCard
              label="Manual Pending"
              value={money(summary.totalPendingPayouts)}
              helper="Manual payout requests"
            />

            <StatCard
              label="Manual Paid"
              value={money(summary.totalPaidPayouts)}
              helper="Recently paid manual payouts"
            />

            <StatCard
              label="Refund Impact"
              value={money(summary.refundDeductions)}
              helper="Recent refund deductions"
              tone={summary.refundDeductions > 0 ? "danger" : "normal"}
            />
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <Panel
                title="Recent Paystack Split Settlements"
                description="These records come from payment_splits. They represent the split-payment flow where StoreForge keeps the platform fee and the merchant receives the remaining settlement through Paystack."
              >
                {paymentSplits.length === 0 ? (
                  <EmptyState
                    title="No split settlements yet"
                    description="Split settlement records will appear here after customers pay through Paystack."
                  />
                ) : (
                  <div className="space-y-4">
                    {paymentSplits.map((split) => (
                      <div
                        key={split.id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-md px-2 py-1 text-xs capitalize ${getStatusClass(
                                  split.status
                                )}`}
                              >
                                {formatType(split.status)}
                              </span>

                              <span className="rounded-md bg-blue-100 px-2 py-1 text-xs text-blue-700">
                                Paystack split
                              </span>

                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                {split.currency}
                              </span>
                            </div>

                            <p className="mt-3 font-semibold text-slate-950">
                              Order #{split.order_id.slice(0, 8)}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Ref:{" "}
                              {split.paystack_transaction_reference
                                ? maskValue(split.paystack_transaction_reference)
                                : "Not assigned yet"}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {new Date(split.created_at).toLocaleString()}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-right text-sm sm:grid-cols-4 lg:min-w-[520px]">
                            <AmountBlock
                              label="Order total"
                              value={money(
                                Number(split.order_total || 0),
                                split.currency
                              )}
                            />
                            <AmountBlock
                              label="Platform fee"
                              value={money(
                                Number(split.platform_fee_amount || 0),
                                split.currency
                              )}
                              tone="orange"
                            />
                            <AmountBlock
                              label="Merchant gross"
                              value={money(
                                Number(split.merchant_gross_amount || 0),
                                split.currency
                              )}
                            />
                            <AmountBlock
                              label="Net estimate"
                              value={money(
                                Number(split.merchant_net_estimate || 0),
                                split.currency
                              )}
                              tone="green"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            <div className="space-y-8">
              <Panel
                title="Settlement Account"
                description="Your Paystack setup controls whether customers can pay online."
              >
                <div className="space-y-4 text-sm">
                  <SetupRow label="Store" value={tenant.name} />
                  <SetupRow label="Currency" value={currency} />
                  <SetupRow
                    label="Status"
                    value={tenant.payout_setup_status || "not_started"}
                  />
                  <SetupRow
                    label="Subaccount"
                    value={tenant.paystack_subaccount_code || "Not created"}
                  />
                  <SetupRow
                    label="Platform fee"
                    value={`${Number(
                      tenant.platform_commission_percentage || 5
                    )}%`}
                  />
                  <SetupRow
                    label="Paystack fees"
                    value={
                      tenant.payment_fee_bearer === "platform"
                        ? "StoreForge bears fees"
                        : "Merchant bears fees"
                    }
                  />
                </div>
              </Panel>

              <Panel
                title="Manual Payouts"
                description="Manual payouts are now fallback records for special cases."
              >
                {payouts.length === 0 ? (
                  <EmptyState
                    title="No manual payout requests"
                    description="Most payments should now be settled through Paystack split settlement."
                  />
                ) : (
                  <div className="space-y-4">
                    {payouts.map((payout) => (
                      <div
                        key={payout.id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`rounded-md px-2 py-1 text-xs capitalize ${getStatusClass(
                              payout.status
                            )}`}
                          >
                            {payout.status}
                          </span>

                          <p className="font-bold">
                            {money(Number(payout.amount || 0), payout.currency)}
                          </p>
                        </div>

                        <p className="mt-3 font-semibold text-slate-950">
                          {payout.payout_method === "mobile_money"
                            ? payout.momo_name ||
                              payout.momo_number ||
                              "Mobile money payout"
                            : payout.account_name ||
                              payout.bank_name ||
                              "Bank payout"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Requested{" "}
                          {new Date(payout.requested_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>

          <Panel
            title="Fallback Wallet Transactions"
            description="These are old wallet/manual-flow transactions. With Paystack split settlements, normal orders should appear in the split settlement table above instead."
          >
            {transactions.length === 0 ? (
              <EmptyState
                title="No fallback wallet transactions"
                description="Wallet transactions will only appear for fallback flows, refunds, adjustments, or legacy orders."
              />
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-1 text-xs capitalize ${getTransactionTypeClass(
                            transaction.type
                          )}`}
                        >
                          {formatType(transaction.type)}
                        </span>

                        <span
                          className={`rounded-md px-2 py-1 text-xs capitalize ${getStatusClass(
                            transaction.status
                          )}`}
                        >
                          {transaction.status}
                        </span>

                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs capitalize text-slate-600">
                          {transaction.balance_type}
                        </span>
                      </div>

                      <p className="mt-3 font-semibold">
                        {transaction.description || formatType(transaction.type)}
                      </p>

                      {transaction.order_id && (
                        <p className="mt-1 text-xs text-slate-500">
                          Order #{transaction.order_id.slice(0, 8)}
                        </p>
                      )}

                      {transaction.reference && (
                        <p className="mt-1 text-xs text-slate-500">
                          Ref: {maskValue(transaction.reference)}
                        </p>
                      )}

                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          transaction.type === "refund_deduction"
                            ? "text-red-600"
                            : transaction.type === "platform_fee"
                              ? "text-orange-600"
                              : "text-slate-950"
                        }`}
                      >
                        {transaction.type === "refund_deduction" ||
                        transaction.type === "platform_fee"
                          ? "-"
                          : ""}
                        {money(Number(transaction.net_amount || 0))}
                      </p>

                      {Number(transaction.platform_fee_amount || 0) > 0 && (
                        <p className="mt-1 text-xs text-orange-600">
                          Fee:{" "}
                          {money(Number(transaction.platform_fee_amount || 0))}
                        </p>
                      )}

                      {Number(transaction.payment_processor_fee_amount || 0) >
                        0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          Processor:{" "}
                          {money(
                            Number(
                              transaction.payment_processor_fee_amount || 0
                            )
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function StatusBadge({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-sm font-bold ${
          active ? "text-green-300" : "text-yellow-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  tone = "normal",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "normal" | "danger";
}) {
  return (
    <div
      className={`rounded-3xl p-6 shadow-sm ${
        tone === "danger"
          ? "border border-red-200 bg-red-50"
          : "border border-slate-200 bg-white"
      }`}
    >
      <p
        className={`text-sm ${
          tone === "danger" ? "text-red-600" : "text-slate-500"
        }`}
      >
        {label}
      </p>

      <h2
        className={`mt-2 text-3xl font-bold ${
          tone === "danger" ? "text-red-700" : "text-slate-950"
        }`}
      >
        {value}
      </h2>

      {helper && (
        <p
          className={`mt-2 text-xs ${
            tone === "danger" ? "text-red-500" : "text-slate-400"
          }`}
        >
          {helper}
        </p>
      )}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function AmountBlock({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "green" | "orange";
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`mt-1 font-bold ${
          tone === "green"
            ? "text-green-700"
            : tone === "orange"
              ? "text-orange-600"
              : "text-slate-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SetupRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] break-words text-right font-medium text-slate-950">
        {value}
      </span>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}