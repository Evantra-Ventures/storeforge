"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
} | null;

type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  currency: string | null;
  paystack_subaccount_code: string | null;
  payout_setup_status: string | null;
  platform_commission_percentage: number | null;
  payment_fee_bearer: "merchant" | "platform" | null;
};

type Payout = {
  id: string;
  tenant_id: string;
  wallet_id: string | null;
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
  requested_by: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  external_reference: string | null;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  rejected_at: string | null;
  tenant:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
  wallet: Wallet | Wallet[];
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
  tenant:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
};

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "GHS").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "GHS";
}

function money(amount: number, currency = "GHS") {
  return `${normalizeCurrency(currency)} ${Number(amount || 0).toFixed(2)}`;
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
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
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
    case "disabled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AdminPayoutsPage() {
  const supabase = createClient();

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [storesNeedingSetup, setStoresNeedingSetup] = useState<TenantSummary[]>(
    []
  );

  const [adminId, setAdminId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [splitStatusFilter, setSplitStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingSplitId, setUpdatingSplitId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const getTenant = (payout: Payout) => {
    if (!payout.tenant) return null;
    return Array.isArray(payout.tenant) ? payout.tenant[0] : payout.tenant;
  };

  const getSplitTenant = (split: PaymentSplit) => {
    if (!split.tenant) return null;
    return Array.isArray(split.tenant) ? split.tenant[0] : split.tenant;
  };

  const getWallet = (payout: Payout) => {
    if (!payout.wallet) return null;
    return Array.isArray(payout.wallet) ? payout.wallet[0] : payout.wallet;
  };

  const hasPlatformBalanceDue = (payout: Payout) => {
    const wallet = getWallet(payout);
    return Number(wallet?.platform_balance_due || 0) > 0;
  };

  const fetchAdminPayouts = async () => {
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

      setAdminId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const allowedAdminRoles = ["platform_admin", "admin", "super_admin"];

      if (profileError || !allowedAdminRoles.includes(profile?.role || "")) {
        setIsPlatformAdmin(false);
        setErrorMessage("Only platform admins can access settlement monitoring.");
        return;
      }

      setIsPlatformAdmin(true);

      let payoutQuery = supabase
        .from("merchant_payouts")
        .select(`
          *,
          tenant:tenants (
            id,
            name,
            slug
          ),
          wallet:merchant_wallets (
            id,
            tenant_id,
            pending_balance,
            available_balance,
            platform_balance_due,
            lifetime_earnings,
            lifetime_payouts,
            lifetime_fees,
            lifetime_refunds,
            currency
          )
        `)
        .order("created_at", { ascending: false });

      if (statusFilter) {
        payoutQuery = payoutQuery.eq("status", statusFilter);
      }

      const { data: payoutData, error: payoutError } = await payoutQuery;

      if (payoutError) {
        setErrorMessage(payoutError.message);
        return;
      }

      setPayouts((payoutData || []) as Payout[]);

      let splitQuery = supabase
        .from("payment_splits")
        .select(`
          *,
          tenant:tenants (
            id,
            name,
            slug
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (splitStatusFilter) {
        splitQuery = splitQuery.eq("status", splitStatusFilter);
      }

      const { data: splitData, error: splitError } = await splitQuery;

      if (splitError) {
        setErrorMessage(splitError.message);
        return;
      }

      setPaymentSplits((splitData || []) as PaymentSplit[]);

      const { data: tenantSetupData, error: tenantSetupError } = await supabase
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
        .or(
          "paystack_subaccount_code.is.null,payout_setup_status.neq.active"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (tenantSetupError) {
        console.error("Stores needing setup load error:", tenantSetupError);
      }

      setStoresNeedingSetup((tenantSetupData || []) as TenantSummary[]);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load settlement monitoring.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, splitStatusFilter]);

  const approvePayout = async (payout: Payout) => {
    if (!adminId) return;

    if (hasPlatformBalanceDue(payout)) {
      const wallet = getWallet(payout);

      setErrorMessage(
        `Cannot approve manual payout. This merchant has ${money(
          Number(wallet?.platform_balance_due || 0),
          wallet?.currency || payout.currency
        )} platform balance due.`
      );
      return;
    }

    const adminNote = prompt("Optional approval note:") || null;

    try {
      setUpdatingId(payout.id);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc("approve_merchant_payout", {
        p_payout_id: payout.id,
        p_admin_id: adminId,
        p_admin_note: adminNote,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Manual payout approved.");
      await fetchAdminPayouts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to approve manual payout.");
    } finally {
      setUpdatingId(null);
    }
  };

  const markPaid = async (payout: Payout) => {
    if (!adminId) return;

    if (hasPlatformBalanceDue(payout)) {
      const wallet = getWallet(payout);

      setErrorMessage(
        `Cannot mark manual payout as paid. This merchant has ${money(
          Number(wallet?.platform_balance_due || 0),
          wallet?.currency || payout.currency
        )} platform balance due.`
      );
      return;
    }

    const externalReference =
      prompt("Enter payment reference or transaction ID:") || null;

    const adminNote = prompt("Optional payment note:") || null;

    const confirmed = confirm(
      "Confirm that you have sent this manual payout to the merchant?"
    );

    if (!confirmed) return;

    try {
      setUpdatingId(payout.id);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc("mark_merchant_payout_paid", {
        p_payout_id: payout.id,
        p_admin_id: adminId,
        p_external_reference: externalReference,
        p_admin_note: adminNote,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Manual payout marked as paid.");
      await fetchAdminPayouts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to mark manual payout as paid.");
    } finally {
      setUpdatingId(null);
    }
  };

  const rejectPayout = async (payoutId: string) => {
    if (!adminId) return;

    const reason = prompt("Enter rejection reason:");

    if (!reason) {
      setErrorMessage("Rejection reason is required.");
      return;
    }

    const confirmed = confirm(
      "Reject this manual payout? The amount will be returned to merchant available balance."
    );

    if (!confirmed) return;

    try {
      setUpdatingId(payoutId);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc("reject_merchant_payout", {
        p_payout_id: payoutId,
        p_admin_id: adminId,
        p_rejection_reason: reason,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Manual payout rejected and balance restored.");
      await fetchAdminPayouts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to reject manual payout.");
    } finally {
      setUpdatingId(null);
    }
  };

  const updateSplitStatus = async (split: PaymentSplit, status: string) => {
    const confirmed = confirm(
      `Mark split settlement for order #${split.order_id.slice(
        0,
        8
      )} as ${formatType(status)}?`
    );

    if (!confirmed) return;

    const note = prompt("Optional admin note for metadata:") || null;

    try {
      setUpdatingSplitId(split.id);
      setErrorMessage("");
      setSuccessMessage("");

      const metadataPatch = {
        admin_status_update: {
          status,
          note,
          updated_at: new Date().toISOString(),
          updated_by: adminId,
        },
      };

      const { error } = await supabase
        .from("payment_splits")
        .update({
          status,
          metadata: metadataPatch,
          updated_at: new Date().toISOString(),
        })
        .eq("id", split.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const orderSettlementStatus =
        status === "settled"
          ? "settled"
          : status === "failed" || status === "reversed"
            ? "failed"
            : status === "manual_review"
              ? "manual_review"
              : "processing";

      await supabase
        .from("orders")
        .update({
          settlement_status: orderSettlementStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", split.order_id);

      setSuccessMessage(`Split settlement marked as ${formatType(status)}.`);
      await fetchAdminPayouts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update split settlement.");
    } finally {
      setUpdatingSplitId(null);
    }
  };

  const totals = useMemo(() => {
    const manualPending = payouts
      .filter((payout) => payout.status === "pending")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const manualApproved = payouts
      .filter((payout) => payout.status === "approved")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const manualPaid = payouts
      .filter((payout) => payout.status === "paid")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const manualRejected = payouts
      .filter((payout) => payout.status === "rejected")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const platformBalanceDue = payouts.reduce((acc, payout) => {
      const wallet = getWallet(payout);
      return acc + Number(wallet?.platform_balance_due || 0);
    }, 0);

    const blockedPayouts = payouts.filter(hasPlatformBalanceDue).length;

    const splitTotal = paymentSplits.reduce(
      (acc, split) => acc + Number(split.order_total || 0),
      0
    );

    const splitMerchantTotal = paymentSplits.reduce(
      (acc, split) => acc + Number(split.merchant_net_estimate || 0),
      0
    );

    const splitFees = paymentSplits.reduce(
      (acc, split) => acc + Number(split.platform_fee_amount || 0),
      0
    );

    const splitReviewCount = paymentSplits.filter((split) =>
      ["failed", "reversed", "manual_review"].includes(split.status)
    ).length;

    const splitProcessingCount = paymentSplits.filter((split) =>
      ["initialized", "paid"].includes(split.status)
    ).length;

    const settledCount = paymentSplits.filter(
      (split) => split.status === "settled"
    ).length;

    return {
      manualPending,
      manualApproved,
      manualPaid,
      manualRejected,
      platformBalanceDue,
      blockedPayouts,
      splitTotal,
      splitMerchantTotal,
      splitFees,
      splitReviewCount,
      splitProcessingCount,
      settledCount,
    };
  }, [payouts, paymentSplits]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-500">Loading settlement monitoring...</p>
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-slate-500">
          Only platform admins can access settlement monitoring.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}
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
              StoreForge platform finance
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
              Settlement Monitoring
            </h1>

            <p className="mt-4 max-w-3xl text-slate-300">
              Monitor Paystack split settlements, manual payout fallback
              requests, blocked payouts, and merchants that still need
              settlement setup.
            </p>
          </div>

          <button
            onClick={fetchAdminPayouts}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200"
          >
            Refresh
          </button>
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

      {totals.blockedPayouts > 0 && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
          <p className="font-semibold">Some manual payouts are blocked</p>
          <p className="mt-1 text-sm leading-6">
            {totals.blockedPayouts} manual payout request(s) belong to merchants
            with platform balance due. Resolve the due balance before approving
            or marking those payouts as paid.
          </p>
        </div>
      )}

      {storesNeedingSetup.length > 0 && (
        <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-5 text-yellow-800">
          <p className="font-semibold">Some stores cannot accept online payments</p>
          <p className="mt-1 text-sm leading-6">
            {storesNeedingSetup.length} store(s) do not have active Paystack
            settlement setup. Customers may be blocked from online checkout for
            those stores.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatCard
          label="Split Sales"
          value={money(totals.splitTotal)}
          helper="Gross Paystack split sales"
        />
        <StatCard
          label="Merchant Settlements"
          value={money(totals.splitMerchantTotal)}
          helper="Merchant net estimate"
        />
        <StatCard
          label="StoreForge Fees"
          value={money(totals.splitFees)}
          helper="Platform fees from splits"
        />
        <StatCard
          label="Split Review Cases"
          value={totals.splitReviewCount}
          helper="Failed, reversed, manual review"
          tone={totals.splitReviewCount > 0 ? "danger" : "normal"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <StatCard label="Manual Pending" value={money(totals.manualPending)} />
        <StatCard label="Manual Approved" value={money(totals.manualApproved)} />
        <StatCard label="Manual Paid" value={money(totals.manualPaid)} />
        <StatCard
          label="Manual Rejected"
          value={money(totals.manualRejected)}
          tone={totals.manualRejected > 0 ? "danger" : "normal"}
        />
        <StatCard
          label="Platform Due"
          value={money(totals.platformBalanceDue)}
          tone={totals.platformBalanceDue > 0 ? "danger" : "normal"}
        />
      </div>

      <Panel
        title="Paystack Split Settlements"
        description="These are the main settlement records for customer payments. Use this section to monitor paid, settled, failed, reversed, or manual-review split records."
        action={
          <select
            value={splitStatusFilter}
            onChange={(event) => setSplitStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 p-3 text-sm"
          >
            <option value="">All split statuses</option>
            <option value="initialized">Initialized</option>
            <option value="paid">Paid</option>
            <option value="settled">Settled</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
            <option value="manual_review">Manual Review</option>
          </select>
        }
      >
        {paymentSplits.length === 0 ? (
          <EmptyState
            title="No split settlement records"
            description="Paystack split payment records will appear here when customers initialize and complete checkout."
          />
        ) : (
          <div className="space-y-5">
            {paymentSplits.map((split) => {
              const tenant = getSplitTenant(split);

              return (
                <div
                  key={split.id}
                  className={`rounded-2xl border p-5 ${
                    ["failed", "reversed", "manual_review"].includes(
                      split.status
                    )
                      ? "border-red-200 bg-red-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
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

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                          {split.currency}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold">
                        Order #{split.order_id.slice(0, 8)}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Store: {tenant?.name || "Unknown store"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Ref: {maskReference(split.paystack_transaction_reference)}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Created {new Date(split.created_at).toLocaleString()}
                      </p>

                      {split.paystack_subaccount_code && (
                        <p className="mt-1 text-xs text-slate-500">
                          Subaccount:{" "}
                          {maskReference(split.paystack_subaccount_code)}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-right text-sm md:grid-cols-4 xl:min-w-[520px]">
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

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {split.status !== "settled" && (
                      <button
                        onClick={() => updateSplitStatus(split, "settled")}
                        disabled={updatingSplitId === split.id}
                        className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Mark Settled
                      </button>
                    )}

                    {split.status !== "manual_review" && (
                      <button
                        onClick={() =>
                          updateSplitStatus(split, "manual_review")
                        }
                        disabled={updatingSplitId === split.id}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                      >
                        Manual Review
                      </button>
                    )}

                    {split.status !== "failed" && (
                      <button
                        onClick={() => updateSplitStatus(split, "failed")}
                        disabled={updatingSplitId === split.id}
                        className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        Mark Failed
                      </button>
                    )}

                    {split.status !== "reversed" && (
                      <button
                        onClick={() => updateSplitStatus(split, "reversed")}
                        disabled={updatingSplitId === split.id}
                        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        Mark Reversed
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel
        title="Manual Payout Requests"
        description="Manual payouts are fallback records for legacy wallet balances, adjustments, or failed split settlement cases."
        action={
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 p-3 text-sm"
          >
            <option value="">All manual statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        }
      >
        {payouts.length === 0 ? (
          <EmptyState
            title="No manual payout requests"
            description="Manual payout requests will appear here when merchants request fallback payouts."
          />
        ) : (
          <div className="space-y-5">
            {payouts.map((payout) => {
              const tenant = getTenant(payout);
              const wallet = getWallet(payout);
              const isBlocked = hasPlatformBalanceDue(payout);

              return (
                <div
                  key={payout.id}
                  className={`rounded-2xl border p-5 ${
                    isBlocked ? "border-red-200 bg-red-50/40" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
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

                        {isBlocked && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">
                            Blocked: Platform Due
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-lg font-semibold">
                        Manual payout #{payout.id.slice(0, 8)}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Store: {tenant?.name || "Unknown store"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Requested {new Date(payout.requested_at).toLocaleString()}
                      </p>

                      <div className="mt-4 rounded-2xl border bg-white p-4 text-sm">
                        {payout.payout_method === "mobile_money" ? (
                          <>
                            <p className="font-medium">
                              {payout.momo_name || "Mobile Money"}
                            </p>
                            <p className="text-slate-500">
                              {payout.momo_provider || "MoMo"} ·{" "}
                              {maskAccount(payout.momo_number)}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium">
                              {payout.account_name || "Bank Account"}
                            </p>
                            <p className="text-slate-500">
                              {payout.bank_name || "Bank"} ·{" "}
                              {maskAccount(payout.account_number)}
                            </p>
                          </>
                        )}
                      </div>

                      {wallet && (
                        <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                          <WalletMiniCard
                            label="Available"
                            value={money(
                              Number(wallet.available_balance || 0),
                              wallet.currency || payout.currency
                            )}
                          />

                          <WalletMiniCard
                            label="Pending"
                            value={money(
                              Number(wallet.pending_balance || 0),
                              wallet.currency || payout.currency
                            )}
                          />

                          <WalletMiniCard
                            label="Platform Due"
                            value={money(
                              Number(wallet.platform_balance_due || 0),
                              wallet.currency || payout.currency
                            )}
                            danger={Number(wallet.platform_balance_due || 0) > 0}
                          />
                        </div>
                      )}

                      {payout.external_reference && (
                        <p className="mt-3 text-xs text-slate-500">
                          Reference: {payout.external_reference}
                        </p>
                      )}

                      {payout.rejection_reason && (
                        <p className="mt-3 text-xs text-red-600">
                          Rejection reason: {payout.rejection_reason}
                        </p>
                      )}

                      {payout.admin_note && (
                        <p className="mt-3 text-xs text-slate-500">
                          Admin note: {payout.admin_note}
                        </p>
                      )}
                    </div>

                    <div className="lg:text-right">
                      <p className="text-3xl font-bold">
                        {money(Number(payout.amount || 0), payout.currency)}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
                        {payout.status === "pending" && (
                          <>
                            <button
                              onClick={() => approvePayout(payout)}
                              disabled={updatingId === payout.id || isBlocked}
                              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => rejectPayout(payout.id)}
                              disabled={updatingId === payout.id}
                              className="rounded-xl bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              Reject
                            </button>

                            <button
                              onClick={() => markPaid(payout)}
                              disabled={updatingId === payout.id || isBlocked}
                              className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                            >
                              Mark Paid
                            </button>
                          </>
                        )}

                        {payout.status === "approved" && (
                          <>
                            <button
                              onClick={() => rejectPayout(payout.id)}
                              disabled={updatingId === payout.id}
                              className="rounded-xl bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              Reject
                            </button>

                            <button
                              onClick={() => markPaid(payout)}
                              disabled={updatingId === payout.id || isBlocked}
                              className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                            >
                              Mark Paid
                            </button>
                          </>
                        )}

                        {payout.status === "paid" && (
                          <span className="text-sm text-green-700">
                            Paid{" "}
                            {payout.paid_at
                              ? new Date(payout.paid_at).toLocaleString()
                              : ""}
                          </span>
                        )}

                        {payout.status === "rejected" && (
                          <span className="text-sm text-red-700">
                            Rejected{" "}
                            {payout.rejected_at
                              ? new Date(payout.rejected_at).toLocaleString()
                              : ""}
                          </span>
                        )}
                      </div>

                      {isBlocked && (
                        <p className="mt-3 max-w-xs text-xs text-red-600">
                          Approval and payment are disabled until the merchant’s
                          platform balance due is cleared.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel
        title="Stores Needing Settlement Setup"
        description="These stores may be blocked from online checkout until Paystack settlement is active."
      >
        {storesNeedingSetup.length === 0 ? (
          <EmptyState
            title="All stores are settlement-ready"
            description="No store setup issues were found."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {storesNeedingSetup.map((store) => (
              <div
                key={store.id}
                className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs capitalize ${getStatusClass(
                      store.payout_setup_status || "not_started"
                    )}`}
                  >
                    {formatType(store.payout_setup_status || "not_started")}
                  </span>

                  {!store.paystack_subaccount_code && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">
                      Missing subaccount
                    </span>
                  )}
                </div>

                <h3 className="mt-3 font-semibold text-slate-950">
                  {store.name}
                </h3>

                <p className="mt-1 text-sm text-slate-600">/{store.slug}</p>

                <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
                  <SetupRow
                    label="Currency"
                    value={normalizeCurrency(store.currency)}
                  />
                  <SetupRow
                    label="Platform fee"
                    value={`${Number(
                      store.platform_commission_percentage || 5
                    )}%`}
                  />
                  <SetupRow
                    label="Fee bearer"
                    value={
                      store.payment_fee_bearer === "platform"
                        ? "StoreForge"
                        : "Merchant"
                    }
                  />
                  <SetupRow
                    label="Subaccount"
                    value={store.paystack_subaccount_code || "Not created"}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
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
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          {description && (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {description}
            </p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function WalletMiniCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        danger ? "border-red-200 bg-red-50" : "bg-slate-50"
      }`}
    >
      <p className={danger ? "text-red-600" : "text-slate-500"}>{label}</p>
      <p className={`mt-1 font-semibold ${danger ? "text-red-700" : ""}`}>
        {value}
      </p>
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

function SetupRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-yellow-200/70 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-600">{label}</span>
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
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}