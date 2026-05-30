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

export default function PayoutRequestPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);

  const [amount, setAmount] = useState("");
  const [payoutAccountId, setPayoutAccountId] = useState("");

  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const money = (value: number, currency = wallet?.currency || "GHS") =>
    `${currency} ${Number(value || 0).toFixed(2)}`;

  const maskAccount = (value: string | null) => {
    if (!value) return "Not provided";
    if (value.length <= 4) return value;
    return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "paid":
      case "approved":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "rejected":
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const fetchPayoutData = async () => {
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

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setErrorMessage("Tenant profile not found.");
        return;
      }

      setTenantId(profile.tenant_id);

      let { data: walletData } = await supabase
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
            newWalletError?.message || "Failed to load merchant wallet."
          );
          return;
        }

        walletData = newWalletData;
      }

      setWallet(walletData);

      const { data: accountsData, error: accountsError } = await supabase
        .from("tenant_payout_accounts")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (accountsError) {
        setErrorMessage(accountsError.message);
        return;
      }

      setAccounts(accountsData || []);

      const defaultAccount = (accountsData || []).find(
        (account) => account.is_default
      );

      if (defaultAccount) {
        setPayoutAccountId(defaultAccount.id);
      } else if (accountsData && accountsData.length > 0) {
        setPayoutAccountId(accountsData[0].id);
      }

      const { data: payoutsData, error: payoutsError } = await supabase
        .from("merchant_payouts")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (payoutsError) {
        setErrorMessage(payoutsError.message);
        return;
      }

      setPayouts(payoutsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load payout data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayoutData();
  }, []);

  const selectedAccount = useMemo(() => {
    return accounts.find((account) => account.id === payoutAccountId) || null;
  }, [accounts, payoutAccountId]);

  const pendingPayoutTotal = useMemo(() => {
    return payouts
      .filter((payout) => payout.status === "pending")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);
  }, [payouts]);

  const paidPayoutTotal = useMemo(() => {
    return payouts
      .filter((payout) => payout.status === "paid")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);
  }, [payouts]);

  const hasPlatformBalanceDue =
    Number(wallet?.platform_balance_due || 0) > 0;

  const validateRequest = () => {
    if (!tenantId || !userId) {
      setErrorMessage("Tenant or user not found.");
      return false;
    }

    if (!wallet) {
      setErrorMessage("Merchant wallet not found.");
      return false;
    }

    if (Number(wallet.platform_balance_due || 0) > 0) {
      setErrorMessage(
        "Payouts are temporarily blocked because your store has a platform balance due from refund deductions."
      );
      return false;
    }

    if (accounts.length === 0) {
      setErrorMessage("Add a payout account before requesting a payout.");
      return false;
    }

    if (!payoutAccountId) {
      setErrorMessage("Select a payout account.");
      return false;
    }

    const amountNumber = Number(amount);

    if (!amount || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      setErrorMessage("Enter a valid payout amount.");
      return false;
    }

    if (amountNumber > Number(wallet.available_balance || 0)) {
      setErrorMessage("Payout amount cannot exceed available balance.");
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
        `Request payout of ${money(Number(amount))}? This amount will be deducted from your available balance while pending.`
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
        `Payout request submitted successfully. Reference #${String(
          payoutId
        ).slice(0, 8)}`
      );

      setAmount("");
      fetchPayoutData();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to request payout.");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return <p className="text-slate-500">Loading payout page...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <a href="/wallet" className="text-sm text-slate-500 hover:text-black">
          ← Back to Wallet
        </a>

        <h1 className="text-3xl font-bold mt-4">Request Payout</h1>
        <p className="text-slate-500 mt-2">
          Withdraw available merchant earnings to your bank or mobile money
          account.
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

      {hasPlatformBalanceDue && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5">
          <p className="font-semibold">Payouts Temporarily Blocked</p>
          <p className="text-sm mt-1">
            Your store currently owes{" "}
            <span className="font-bold">
              {money(Number(wallet?.platform_balance_due || 0))}
            </span>{" "}
            to StoreForge because refund deductions exceeded your available and
            pending balance. Clear this balance before requesting a new payout.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard
          label="Available Balance"
          value={money(wallet?.available_balance || 0)}
          helper="Can be withdrawn"
        />

        <StatCard
          label="Pending Balance"
          value={money(wallet?.pending_balance || 0)}
          helper="Not yet available"
        />

        <StatCard
          label="Platform Balance Due"
          value={money(wallet?.platform_balance_due || 0)}
          helper="Must be cleared before payout"
          tone={hasPlatformBalanceDue ? "danger" : "normal"}
        />

        <StatCard
          label="Pending Payouts"
          value={money(pendingPayoutTotal)}
          helper="Awaiting review"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard
          label="Paid Payouts"
          value={money(paidPayoutTotal)}
          helper="Recently paid"
        />

        <StatCard
          label="Lifetime Earnings"
          value={money(wallet?.lifetime_earnings || 0)}
          helper="Total merchant earnings"
        />

        <StatCard
          label="Lifetime Refunds"
          value={money(wallet?.lifetime_refunds || 0)}
          helper="Refund impact"
        />

        <StatCard
          label="Lifetime Payouts"
          value={money(wallet?.lifetime_payouts || 0)}
          helper="Total paid out"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">New Payout Request</h2>
            <p className="text-sm text-slate-500 mt-1">
              Payout requests are reviewed by the StoreForge platform admin.
            </p>
          </div>

          {accounts.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-2xl p-5">
              <p className="font-semibold">No payout account found</p>
              <p className="text-sm mt-1">
                Add a bank or mobile money payout account before requesting a
                payout.
              </p>

              <a
                href="/settings/payout"
                className="inline-block bg-black text-white px-5 py-3 rounded-xl text-sm mt-4"
              >
                Add Payout Account
              </a>
            </div>
          ) : hasPlatformBalanceDue ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5">
              <p className="font-semibold">Payout request unavailable</p>
              <p className="text-sm mt-1">
                You cannot request a payout while your store has a platform
                balance due. This protects StoreForge and merchants from payout
                errors after refunds.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Payout Account
                </label>

                <select
                  value={payoutAccountId}
                  onChange={(e) => setPayoutAccountId(e.target.value)}
                  className="w-full border rounded-xl p-3"
                >
                  {accounts.map((account) => (
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
              </div>

              {selectedAccount && (
                <div className="bg-slate-50 border rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">
                      {selectedAccount.payout_method.replaceAll("_", " ")}
                    </span>

                    {selectedAccount.is_default && (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                        Default
                      </span>
                    )}
                  </div>

                  {selectedAccount.payout_method === "mobile_money" ? (
                    <div>
                      <p className="font-semibold">
                        {selectedAccount.momo_name || "Mobile Money"}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {selectedAccount.momo_provider || "MoMo"} ·{" "}
                        {maskAccount(selectedAccount.momo_number)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold">
                        {selectedAccount.account_name || "Bank Account"}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {selectedAccount.bank_name || "Bank"} ·{" "}
                        {maskAccount(selectedAccount.account_number)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Payout Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={wallet?.available_balance || 0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Maximum ${money(wallet?.available_balance || 0)}`}
                  className="w-full border rounded-xl p-3"
                />

                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() =>
                      setAmount(
                        Math.max(
                          0,
                          Number(wallet?.available_balance || 0) * 0.25
                        ).toFixed(2)
                      )
                    }
                    className="border px-3 py-2 rounded-xl text-xs hover:bg-slate-100"
                  >
                    25%
                  </button>

                  <button
                    onClick={() =>
                      setAmount(
                        Math.max(
                          0,
                          Number(wallet?.available_balance || 0) * 0.5
                        ).toFixed(2)
                      )
                    }
                    className="border px-3 py-2 rounded-xl text-xs hover:bg-slate-100"
                  >
                    50%
                  </button>

                  <button
                    onClick={() =>
                      setAmount(
                        Math.max(
                          0,
                          Number(wallet?.available_balance || 0) * 0.75
                        ).toFixed(2)
                      )
                    }
                    className="border px-3 py-2 rounded-xl text-xs hover:bg-slate-100"
                  >
                    75%
                  </button>

                  <button
                    onClick={() =>
                      setAmount(
                        Number(wallet?.available_balance || 0).toFixed(2)
                      )
                    }
                    className="border px-3 py-2 rounded-xl text-xs hover:bg-slate-100"
                  >
                    Max
                  </button>
                </div>
              </div>

              <button
                onClick={handleRequestPayout}
                disabled={
                  requesting ||
                  !wallet ||
                  Number(wallet.available_balance || 0) <= 0 ||
                  hasPlatformBalanceDue
                }
                className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {requesting ? "Submitting..." : "Submit Payout Request"}
              </button>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-6 h-fit">
          <h2 className="text-xl font-semibold">Payout Notes</h2>

          <div className="text-sm text-slate-500 mt-4 space-y-3">
            <p>
              Payouts can only be requested from your available balance, not your
              pending balance.
            </p>

            <p>
              After you submit a payout request, the amount is deducted from your
              available balance to prevent double withdrawal.
            </p>

            <p>
              If refunds create a platform balance due, payouts are blocked
              until that due balance is cleared.
            </p>

            <p>
              The StoreForge platform admin will review and mark the payout as
              paid after money is sent.
            </p>
          </div>

          <a
            href="/settings/payout"
            className="block text-center border px-4 py-3 rounded-xl text-sm mt-6 hover:bg-slate-100"
          >
            Manage Payout Accounts
          </a>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Payout History</h2>

          <span className="text-sm text-slate-500">
            {payouts.length} payout(s)
          </span>
        </div>

        {payouts.length === 0 ? (
          <p className="text-slate-500">No payout requests yet.</p>
        ) : (
          <div className="space-y-4">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs capitalize ${getStatusClass(
                        payout.status
                      )}`}
                    >
                      {payout.status}
                    </span>

                    {payout.payout_method && (
                      <span className="px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-700 capitalize">
                        {payout.payout_method.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>

                  <p className="font-semibold mt-3">
                    Payout #{payout.id.slice(0, 8)}
                  </p>

                  <p className="text-sm text-slate-500 mt-1">
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

                  <p className="text-xs text-slate-400 mt-1">
                    Requested {new Date(payout.requested_at).toLocaleString()}
                  </p>

                  {payout.rejection_reason && (
                    <p className="text-xs text-red-600 mt-2">
                      Reason: {payout.rejection_reason}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold">
                    {money(Number(payout.amount || 0), payout.currency)}
                  </p>

                  {payout.approved_at && (
                    <p className="text-xs text-green-600 mt-1">
                      Approved {new Date(payout.approved_at).toLocaleString()}
                    </p>
                  )}

                  {payout.paid_at && (
                    <p className="text-xs text-green-600 mt-1">
                      Paid {new Date(payout.paid_at).toLocaleString()}
                    </p>
                  )}

                  {payout.rejected_at && (
                    <p className="text-xs text-red-600 mt-1">
                      Rejected {new Date(payout.rejected_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
        tone === "danger" ? "bg-red-50 border border-red-200" : "bg-white"
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