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

export default function WalletPage() {
  const supabase = createClient();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<MerchantTransaction[]>([]);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const money = (amount: number, currency = wallet?.currency || "GHS") =>
    `${currency} ${Number(amount || 0).toFixed(2)}`;

  const formatType = (type: string) => type.replaceAll("_", " ");

  const getStatusClass = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
      case "approved":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "failed":
      case "rejected":
      case "cancelled":
      case "reversed":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getTransactionTypeClass = (type: string) => {
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
  };

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
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setErrorMessage("Tenant profile not found.");
        return;
      }

      let { data: walletData, error: walletError } = await supabase
        .from("merchant_wallets")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      if (!walletData) {
        const { error: ensureError } = await supabase.rpc(
          "ensure_merchant_wallet",
          {
            p_tenant_id: profile.tenant_id,
            p_currency: "GHS",
          }
        );

        if (ensureError) {
          setErrorMessage(ensureError.message);
          return;
        }

        const { data: newWalletData, error: newWalletError } = await supabase
          .from("merchant_wallets")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .maybeSingle();

        if (newWalletError || !newWalletData) {
          setErrorMessage(
            newWalletError?.message || "Failed to create wallet."
          );
          return;
        }

        walletData = newWalletData;
      }

      if (walletError) {
        setErrorMessage(walletError.message);
        return;
      }

      setWallet(walletData);

      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("merchant_transactions")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .order("created_at", { ascending: false })
          .limit(30);

      if (transactionsError) {
        setErrorMessage(transactionsError.message);
        return;
      }

      setTransactions(transactionsData || []);

      const { data: payoutsData, error: payoutsError } = await supabase
        .from("merchant_payouts")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (payoutsError) {
        setErrorMessage(payoutsError.message);
        return;
      }

      setPayouts(payoutsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load wallet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const summary = useMemo(() => {
    const totalPendingPayouts = payouts
      .filter((payout) => payout.status === "pending")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const totalPaidPayouts = payouts
      .filter((payout) => payout.status === "paid")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const totalOrderCredits = transactions
      .filter((transaction) => transaction.type === "order_credit")
      .reduce((acc, transaction) => acc + Number(transaction.net_amount || 0), 0);

    const totalPlatformFees = transactions
      .filter((transaction) => transaction.type === "platform_fee")
      .reduce(
        (acc, transaction) =>
          acc +
          Number(
            transaction.platform_fee_amount || transaction.net_amount || 0
          ),
        0
      );

    const totalRefundDeductions = transactions
      .filter((transaction) => transaction.type === "refund_deduction")
      .reduce((acc, transaction) => acc + Number(transaction.net_amount || 0), 0);

    return {
      totalPendingPayouts,
      totalPaidPayouts,
      totalOrderCredits,
      totalPlatformFees,
      totalRefundDeductions,
    };
  }, [transactions, payouts]);

  if (loading) {
    return <p className="text-slate-500">Loading wallet...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Wallet</h1>
          <p className="text-slate-500 mt-2">
            Track merchant earnings, platform fees, refunds, payouts, and wallet
            balance.
          </p>
        </div>

        <div className="flex gap-3">
          <a
            href="/settings/payout"
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Payout Settings
          </a>

          <a
            href="/wallet/payouts"
            className="bg-black text-white px-4 py-2 rounded-xl text-sm hover:opacity-90"
          >
            Request Payout
          </a>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-100 text-red-700 p-4 rounded-xl">
          {errorMessage}
        </div>
      )}

      {!wallet ? (
        <div className="bg-white rounded-2xl shadow p-8">
          <h2 className="text-xl font-semibold">Wallet not found</h2>
          <p className="text-slate-500 mt-2">
            Your merchant wallet could not be loaded.
          </p>
        </div>
      ) : (
        <>
          {Number(wallet.platform_balance_due || 0) > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5">
              <p className="font-semibold">Platform Balance Due</p>
              <p className="text-sm mt-1">
                Your store has{" "}
                <span className="font-bold">
                  {money(Number(wallet.platform_balance_due || 0))}
                </span>{" "}
                due to StoreForge because refund deductions exceeded your
                available and pending wallet balance.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <StatCard
              label="Available Balance"
              value={money(wallet.available_balance)}
              helper="Ready for payout"
            />

            <StatCard
              label="Pending Balance"
              value={money(wallet.pending_balance)}
              helper="Held before release"
            />

            <StatCard
              label="Platform Balance Due"
              value={money(wallet.platform_balance_due || 0)}
              helper="Owed after refunds"
              tone={
                Number(wallet.platform_balance_due || 0) > 0
                  ? "danger"
                  : "normal"
              }
            />

            <StatCard
              label="Lifetime Earnings"
              value={money(wallet.lifetime_earnings)}
              helper="Total merchant earnings"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <StatCard
              label="Lifetime Payouts"
              value={money(wallet.lifetime_payouts)}
              helper="Total paid out"
            />

            <StatCard
              label="Platform Fees"
              value={money(wallet.lifetime_fees)}
              helper="StoreForge fees"
            />

            <StatCard
              label="Refund Deductions"
              value={money(wallet.lifetime_refunds)}
              helper="Total refund impact"
            />

            <StatCard
              label="Pending Payouts"
              value={money(summary.totalPendingPayouts)}
              helper="Awaiting approval/payment"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <StatCard
              label="Recent Order Credits"
              value={money(summary.totalOrderCredits)}
              helper="From recent transactions"
            />

            <StatCard
              label="Recent Platform Fees"
              value={money(summary.totalPlatformFees)}
              helper="Recent fee records"
            />

            <StatCard
              label="Recent Refund Deductions"
              value={money(summary.totalRefundDeductions)}
              helper="Recent refund records"
            />

            <StatCard
              label="Recent Paid Payouts"
              value={money(summary.totalPaidPayouts)}
              helper="Recently paid out"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Panel title="Recent Wallet Transactions">
              {transactions.length === 0 ? (
                <p className="text-slate-500">No wallet transactions yet.</p>
              ) : (
                <div className="space-y-4">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-1 rounded-md text-xs capitalize ${getTransactionTypeClass(
                              transaction.type
                            )}`}
                          >
                            {formatType(transaction.type)}
                          </span>

                          <span
                            className={`px-2 py-1 rounded-md text-xs capitalize ${getStatusClass(
                              transaction.status
                            )}`}
                          >
                            {transaction.status}
                          </span>

                          <span className="px-2 py-1 rounded-md text-xs bg-slate-100 text-slate-600 capitalize">
                            {transaction.balance_type}
                          </span>
                        </div>

                        <p className="font-semibold mt-3">
                          {transaction.description ||
                            formatType(transaction.type)}
                        </p>

                        {transaction.order_id && (
                          <p className="text-xs text-slate-500 mt-1">
                            Order #{transaction.order_id.slice(0, 8)}
                          </p>
                        )}

                        {transaction.reference && (
                          <p className="text-xs text-slate-500 mt-1">
                            Ref: {transaction.reference}
                          </p>
                        )}

                        <p className="text-xs text-slate-400 mt-1">
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
                                : ""
                          }`}
                        >
                          {transaction.type === "refund_deduction" ||
                          transaction.type === "platform_fee"
                            ? "-"
                            : ""}
                          {money(Number(transaction.net_amount || 0))}
                        </p>

                        {Number(transaction.platform_fee_amount || 0) > 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            Fee:{" "}
                            {money(Number(transaction.platform_fee_amount || 0))}
                          </p>
                        )}

                        {Number(transaction.payment_processor_fee_amount || 0) >
                          0 && (
                          <p className="text-xs text-slate-500 mt-1">
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

            <Panel title="Recent Payouts">
              {payouts.length === 0 ? (
                <p className="text-slate-500">No payout requests yet.</p>
              ) : (
                <div className="space-y-4">
                  {payouts.map((payout) => (
                    <div
                      key={payout.id}
                      className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-1 rounded-md text-xs capitalize ${getStatusClass(
                              payout.status
                            )}`}
                          >
                            {payout.status}
                          </span>

                          {payout.payout_method && (
                            <span className="px-2 py-1 rounded-md text-xs bg-slate-100 text-slate-600 capitalize">
                              {payout.payout_method.replaceAll("_", " ")}
                            </span>
                          )}
                        </div>

                        <p className="font-semibold mt-3">
                          {payout.payout_method === "mobile_money"
                            ? payout.momo_name ||
                              payout.momo_number ||
                              "Mobile money payout"
                            : payout.account_name ||
                              payout.bank_name ||
                              "Bank payout"}
                        </p>

                        <p className="text-xs text-slate-500 mt-1">
                          {payout.payout_method === "mobile_money"
                            ? [payout.momo_provider, payout.momo_number]
                                .filter(Boolean)
                                .join(" · ")
                            : [payout.bank_name, payout.account_number]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          Requested{" "}
                          {new Date(payout.requested_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold">
                          {money(Number(payout.amount || 0), payout.currency)}
                        </p>

                        {payout.paid_at && (
                          <p className="text-xs text-green-600 mt-1">
                            Paid {new Date(payout.paid_at).toLocaleString()}
                          </p>
                        )}

                        {payout.rejected_at && (
                          <p className="text-xs text-red-600 mt-1">
                            Rejected{" "}
                            {new Date(payout.rejected_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
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
      className={`rounded-2xl shadow p-6 ${
        tone === "danger"
          ? "bg-red-50 border border-red-200"
          : "bg-white"
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
        className={`text-3xl font-bold mt-2 ${
          tone === "danger" ? "text-red-700" : ""
        }`}
      >
        {value}
      </h2>

      {helper && (
        <p
          className={`text-xs mt-2 ${
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-xl font-semibold mb-6">{title}</h2>
      {children}
    </div>
  );
}