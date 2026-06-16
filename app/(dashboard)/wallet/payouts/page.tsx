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
};

type PayoutAccount = {
  id: string;
  payout_method: "bank" | "mobile_money";
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  momo_provider: string | null;
  momo_number: string | null;
  momo_name: string | null;
  currency: string;
  is_default: boolean;
  status: string;
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
  approved_at: string | null;
  paid_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
};

type PaymentSplit = {
  id: string;
  order_id: string;
  currency: string;
  order_total: number;
  platform_fee_amount: number;
  merchant_gross_amount: number;
  merchant_net_estimate: number;
  status: string;
  paystack_transaction_reference: string | null;
  created_at: string;
};

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "GHS").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "GHS";
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function maskAccount(value: string | null) {
  if (!value) return "Not provided";
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function maskReference(value: string | null) {
  if (!value) return "Not assigned";
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getStatusClass(status: string) {
  switch (status) {
    case "active":
    case "paid":
    case "approved":
    case "settled":
    case "completed":
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

export default function PayoutRequestPage() {
  const supabase = createClient();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [legacyAccounts, setLegacyAccounts] = useState<PayoutAccount[]>([]);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);

  const [amount, setAmount] = useState("");
  const [payoutAccountId, setPayoutAccountId] = useState("");

  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const currency = normalizeCurrency(tenant?.currency || wallet?.currency);

  const money = (value: number, selectedCurrency = currency) =>
    `${normalizeCurrency(selectedCurrency)} ${Number(value || 0).toFixed(2)}`;

  const settlementReady = Boolean(
    tenant?.paystack_subaccount_code && tenant?.payout_setup_status === "active"
  );

  const hasPlatformBalanceDue = Number(wallet?.platform_balance_due || 0) > 0;
  const availableFallbackBalance = Number(wallet?.available_balance || 0);

  const fetchPayoutData = async () => {
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
        setErrorMessage("You do not have permission to view manual payouts.");
        return;
      }

      setTenantId(profile.tenant_id);

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

        if (ensureError) {
          console.error("Wallet ensure error:", ensureError);
        } else {
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

      const { data: accountsData, error: accountsError } = await supabase
        .from("tenant_payout_accounts")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (accountsError) {
        console.error("Legacy payout accounts load error:", accountsError);
      }

      const loadedAccounts = accountsData || [];
      setLegacyAccounts(loadedAccounts);

      const defaultAccount = loadedAccounts.find((account) => account.is_default);

      if (defaultAccount) {
        setPayoutAccountId(defaultAccount.id);
      } else if (loadedAccounts.length > 0) {
        setPayoutAccountId(loadedAccounts[0].id);
      }

      const { data: splitsData, error: splitsError } = await supabase
        .from("payment_splits")
        .select(`
          id,
          order_id,
          currency,
          order_total,
          platform_fee_amount,
          merchant_gross_amount,
          merchant_net_estimate,
          status,
          paystack_transaction_reference,
          created_at
        `)
        .eq("tenant_id", profile.tenant_id)
        .in("status", ["failed", "reversed", "manual_review"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (splitsError) {
        console.error("Payment split review records load error:", splitsError);
      }

      setPaymentSplits((splitsData || []) as PaymentSplit[]);

      const { data: payoutsData, error: payoutsError } = await supabase
        .from("merchant_payouts")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (payoutsError) {
        setErrorMessage(payoutsError.message);
        return;
      }

      setPayouts(payoutsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load manual payout data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAccount = useMemo(() => {
    return legacyAccounts.find((account) => account.id === payoutAccountId) || null;
  }, [legacyAccounts, payoutAccountId]);

  const payoutSummary = useMemo(() => {
    const pending = payouts
      .filter((payout) => payout.status === "pending")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const approved = payouts
      .filter((payout) => payout.status === "approved")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const paid = payouts
      .filter((payout) => payout.status === "paid")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const rejected = payouts
      .filter((payout) => payout.status === "rejected")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    return { pending, approved, paid, rejected };
  }, [payouts]);

  const splitReviewTotal = useMemo(() => {
    return paymentSplits.reduce(
      (acc, split) => acc + Number(split.merchant_net_estimate || 0),
      0
    );
  }, [paymentSplits]);

  const canRequestManualPayout =
    Boolean(wallet) &&
    availableFallbackBalance > 0 &&
    !hasPlatformBalanceDue &&
    legacyAccounts.length > 0;

  const validateRequest = () => {
    if (!tenantId || !userId) {
      setErrorMessage("Tenant or user not found.");
      return false;
    }

    if (!wallet) {
      setErrorMessage("Fallback wallet not found.");
      return false;
    }

    if (Number(wallet.platform_balance_due || 0) > 0) {
      setErrorMessage(
        "Manual payouts are blocked because your store has a platform balance due from refund deductions."
      );
      return false;
    }

    if (legacyAccounts.length === 0) {
      setErrorMessage(
        "No legacy payout account is available for manual payout requests. Use Paystack settlement setup for normal payments, or contact platform admin for a manual adjustment."
      );
      return false;
    }

    if (!payoutAccountId) {
      setErrorMessage("Select a legacy payout destination.");
      return false;
    }

    const amountNumber = Number(amount);

    if (!amount || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      setErrorMessage("Enter a valid manual payout amount.");
      return false;
    }

    if (amountNumber > Number(wallet.available_balance || 0)) {
      setErrorMessage("Manual payout amount cannot exceed fallback wallet balance.");
      return false;
    }

    return true;
  };

  const handleRequestPayout = async () => {
    try {
      setRequesting(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!validateRequest() || !tenantId || !userId) return;

      const confirmed = confirm(
        `Request manual payout of ${money(
          Number(amount)
        )}? This should only be used for fallback wallet balance, adjustments, or legacy payouts.`
      );

      if (!confirmed) return;

      const { data: payoutId, error } = await supabase.rpc(
        "request_merchant_payout",
        {
          p_tenant_id: tenantId,
          p_requested_by: userId,
          p_amount: Number(amount),
          p_payout_account_id: payoutAccountId || null,
        }
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(
        `Manual payout request submitted. Reference #${String(payoutId).slice(
          0,
          8
        )}`
      );

      setAmount("");
      await fetchPayoutData();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to request manual payout.");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-500">Loading manual payouts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%)]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a href="/wallet" className="text-sm text-slate-300 hover:text-white">
              ← Back to Settlements
            </a>

            <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Fallback payout center
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
              Manual Payouts
            </h1>

            <p className="mt-4 max-w-3xl text-slate-300">
              Normal order payments should settle through Paystack split
              settlement. Use manual payouts only for fallback wallet balances,
              adjustments, failed settlement cases, or legacy wallet credits.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <StatusBadge
                label="Paystack settlement"
                value={settlementReady ? "Active" : "Not active"}
                active={settlementReady}
              />

              <StatusBadge
                label="Fallback wallet"
                value={money(availableFallbackBalance)}
                active={availableFallbackBalance > 0}
              />

              <StatusBadge
                label="Manual review"
                value={money(splitReviewTotal)}
                active={splitReviewTotal === 0}
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
              href="/wallet"
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
              View Settlements
            </a>
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

      {!tenant ? (
        <Panel title="Store not found">
          <p className="text-slate-500">
            Your manual payout page could not load the store profile.
          </p>
        </Panel>
      ) : (
        <>
          {!settlementReady && (
            <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 text-yellow-800">
              <p className="font-semibold">Paystack settlement is not active</p>
              <p className="mt-1 text-sm leading-6">
                Customers cannot complete online checkout until settlement setup
                is active. Complete setup first so future payments settle
                automatically through Paystack.
              </p>

              <a
                href="/settings/payout"
                className="mt-4 inline-block rounded-xl bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700"
              >
                Complete settlement setup
              </a>
            </div>
          )}

          {hasPlatformBalanceDue && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
              <p className="font-semibold">Manual payouts blocked</p>
              <p className="mt-1 text-sm leading-6">
                Your store currently owes{" "}
                <span className="font-bold">
                  {money(Number(wallet?.platform_balance_due || 0))}
                </span>{" "}
                to StoreForge because refund deductions exceeded your available
                and pending fallback wallet balance.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <StatCard
              label="Fallback Available"
              value={money(wallet?.available_balance || 0)}
              helper="Can be manually requested"
            />

            <StatCard
              label="Fallback Pending"
              value={money(wallet?.pending_balance || 0)}
              helper="Not available yet"
            />

            <StatCard
              label="Platform Due"
              value={money(wallet?.platform_balance_due || 0)}
              helper="Blocks manual payouts"
              tone={hasPlatformBalanceDue ? "danger" : "normal"}
            />

            <StatCard
              label="Manual Review"
              value={money(splitReviewTotal)}
              helper="Failed/reversed split cases"
              tone={splitReviewTotal > 0 ? "danger" : "normal"}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <StatCard
              label="Pending Manual"
              value={money(payoutSummary.pending)}
              helper="Awaiting admin review"
            />

            <StatCard
              label="Approved Manual"
              value={money(payoutSummary.approved)}
              helper="Approved but not paid"
            />

            <StatCard
              label="Paid Manual"
              value={money(payoutSummary.paid)}
              helper="Manual payouts completed"
            />

            <StatCard
              label="Rejected Manual"
              value={money(payoutSummary.rejected)}
              helper="Rejected requests"
              tone={payoutSummary.rejected > 0 ? "danger" : "normal"}
            />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Panel
                title="New Manual Payout Request"
                description="Only request a manual payout when you have fallback wallet balance. Normal customer payments should settle directly through Paystack split settlement."
              >
                {!wallet ? (
                  <Notice
                    tone="danger"
                    title="Fallback wallet unavailable"
                    text="Your fallback wallet could not be loaded. Contact platform support if you expected a manual balance."
                  />
                ) : !canRequestManualPayout ? (
                  <div className="space-y-4">
                    {availableFallbackBalance <= 0 && (
                      <Notice
                        title="No fallback balance available"
                        text="There is no available fallback wallet balance to request. Normal Paystack split settlements do not need manual payout requests."
                      />
                    )}

                    {legacyAccounts.length === 0 && (
                      <Notice
                        title="No legacy payout destination"
                        text="Manual payouts require a legacy payout destination. Since StoreForge now uses Paystack split settlement, use Settlement Setup for normal merchant payments or contact platform admin for a special adjustment."
                      />
                    )}

                    {hasPlatformBalanceDue && (
                      <Notice
                        tone="danger"
                        title="Platform balance due"
                        text="Manual payouts are blocked until the platform balance due is cleared."
                      />
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Field label="Legacy payout destination">
                      <select
                        value={payoutAccountId}
                        onChange={(event) =>
                          setPayoutAccountId(event.target.value)
                        }
                        className="field-input"
                      >
                        {legacyAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.payout_method === "mobile_money"
                              ? `${account.momo_provider || "MoMo"} · ${
                                  account.momo_name || account.momo_number
                                }`
                              : `${account.bank_name || "Bank"} · ${
                                  account.account_name || account.account_number
                                }`}
                            {account.is_default ? " · Default" : ""}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {selectedAccount && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize text-slate-700">
                            {selectedAccount.payout_method.replaceAll("_", " ")}
                          </span>

                          {selectedAccount.is_default && (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                              Default
                            </span>
                          )}
                        </div>

                        {selectedAccount.payout_method === "mobile_money" ? (
                          <div>
                            <p className="font-semibold">
                              {selectedAccount.momo_name || "Mobile Money"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {selectedAccount.momo_provider || "MoMo"} ·{" "}
                              {maskAccount(selectedAccount.momo_number)}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold">
                              {selectedAccount.account_name || "Bank Account"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {selectedAccount.bank_name || "Bank"} ·{" "}
                              {maskAccount(selectedAccount.account_number)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <Field label="Manual payout amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={wallet?.available_balance || 0}
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder={`Maximum ${money(
                          wallet?.available_balance || 0
                        )}`}
                        className="field-input"
                      />
                    </Field>

                    <div className="flex flex-wrap gap-2">
                      {[25, 50, 75, 100].map((percent) => (
                        <button
                          key={percent}
                          type="button"
                          onClick={() =>
                            setAmount(
                              Math.max(
                                0,
                                availableFallbackBalance * (percent / 100)
                              ).toFixed(2)
                            )
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-100"
                        >
                          {percent === 100 ? "Max" : `${percent}%`}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleRequestPayout}
                      disabled={requesting || !canRequestManualPayout}
                      className="rounded-2xl bg-slate-950 px-6 py-4 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {requesting
                        ? "Submitting..."
                        : "Submit Manual Payout Request"}
                    </button>
                  </div>
                )}
              </Panel>
            </div>

            <Panel
              title="Manual payout rules"
              description="This page is no longer the main payout flow."
            >
              <div className="space-y-4 text-sm text-slate-600">
                <Rule
                  title="Normal payments"
                  text="Customer payments should settle automatically through Paystack split settlement."
                />

                <Rule
                  title="Manual payouts"
                  text="Use manual payouts only for fallback wallet balances, adjustments, failed split settlements, or legacy orders."
                />

                <Rule
                  title="Refund protection"
                  text="If refund deductions create a platform balance due, manual payouts are blocked until the balance is cleared."
                />

                <Rule
                  title="Admin review"
                  text="Manual payout requests are reviewed and paid by the StoreForge platform admin."
                />
              </div>

              <a
                href="/settings/payout"
                className="mt-6 block rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold hover:bg-slate-50"
              >
                Manage Settlement Setup
              </a>
            </Panel>
          </div>

          <Panel
            title="Split Settlement Manual Review Cases"
            description="Failed, reversed, or manual-review split records appear here. These may require admin action instead of a normal payout request."
          >
            {paymentSplits.length === 0 ? (
              <EmptyState
                title="No manual review cases"
                description="Failed or reversed Paystack split records will appear here if they need review."
              />
            ) : (
              <div className="space-y-4">
                {paymentSplits.map((split) => (
                  <div
                    key={split.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs capitalize ${getStatusClass(
                            split.status
                          )}`}
                        >
                          {formatType(split.status)}
                        </span>

                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                          Paystack split
                        </span>
                      </div>

                      <p className="mt-3 font-semibold">
                        Order #{split.order_id.slice(0, 8)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Ref: {maskReference(split.paystack_transaction_reference)}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(split.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-right text-sm md:grid-cols-4">
                      <AmountBlock
                        label="Order total"
                        value={money(Number(split.order_total || 0), split.currency)}
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
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Manual Payout History">
            {payouts.length === 0 ? (
              <EmptyState
                title="No manual payout requests yet"
                description="Manual payout requests will appear here when submitted."
              />
            ) : (
              <div className="space-y-4">
                {payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs capitalize ${getStatusClass(
                            payout.status
                          )}`}
                        >
                          {payout.status}
                        </span>

                        {payout.payout_method && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize text-slate-700">
                            {payout.payout_method.replaceAll("_", " ")}
                          </span>
                        )}
                      </div>

                      <p className="mt-3 font-semibold">
                        Manual payout #{payout.id.slice(0, 8)}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {payout.payout_method === "mobile_money"
                          ? [
                              payout.momo_provider,
                              maskAccount(payout.momo_number),
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : [payout.bank_name, maskAccount(payout.account_number)]
                              .filter(Boolean)
                              .join(" · ")}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Requested {new Date(payout.requested_at).toLocaleString()}
                      </p>

                      {payout.rejection_reason && (
                        <p className="mt-2 text-xs text-red-600">
                          Reason: {payout.rejection_reason}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {money(Number(payout.amount || 0), payout.currency)}
                      </p>

                      {payout.approved_at && (
                        <p className="mt-1 text-xs text-green-600">
                          Approved {new Date(payout.approved_at).toLocaleString()}
                        </p>
                      )}

                      {payout.paid_at && (
                        <p className="mt-1 text-xs text-green-600">
                          Paid {new Date(payout.paid_at).toLocaleString()}
                        </p>
                      )}

                      {payout.rejected_at && (
                        <p className="mt-1 text-xs text-red-600">
                          Rejected {new Date(payout.rejected_at).toLocaleString()}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function Notice({
  title,
  text,
  tone = "warning",
}: {
  title: string;
  text: string;
  tone?: "warning" | "danger";
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        tone === "danger"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-yellow-200 bg-yellow-50 text-yellow-800"
      }`}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{text}</p>
    </div>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 leading-6">{text}</p>
    </div>
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