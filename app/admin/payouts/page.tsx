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

export default function AdminPayoutsPage() {
  const supabase = createClient();

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const money = (amount: number, currency = "GHS") =>
    `${currency} ${Number(amount || 0).toFixed(2)}`;

  const maskAccount = (value: string | null) => {
    if (!value) return "Not provided";
    if (value.length <= 4) return value;
    return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
  };

  const getTenant = (payout: Payout) => {
    if (!payout.tenant) return null;
    return Array.isArray(payout.tenant) ? payout.tenant[0] : payout.tenant;
  };

  const getWallet = (payout: Payout) => {
    if (!payout.wallet) return null;
    return Array.isArray(payout.wallet) ? payout.wallet[0] : payout.wallet;
  };

  const hasPlatformBalanceDue = (payout: Payout) => {
    const wallet = getWallet(payout);
    return Number(wallet?.platform_balance_due || 0) > 0;
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

  const fetchPayouts = async () => {
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
        .single();

      const allowedAdminRoles = ["platform_admin", "admin", "super_admin"];

      if (profileError || !allowedAdminRoles.includes(profile?.role || "")) {
        setIsPlatformAdmin(false);
        setErrorMessage("Only platform admins can access payout approvals.");
        return;
      }

      setIsPlatformAdmin(true);

      let query = supabase
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
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setPayouts(data || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load payout requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [statusFilter]);

  const approvePayout = async (payout: Payout) => {
    if (!adminId) return;

    if (hasPlatformBalanceDue(payout)) {
      const wallet = getWallet(payout);

      setErrorMessage(
        `Cannot approve payout. This merchant has ${money(
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

      setSuccessMessage("Payout approved.");
      fetchPayouts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to approve payout.");
    } finally {
      setUpdatingId(null);
    }
  };

  const markPaid = async (payout: Payout) => {
    if (!adminId) return;

    if (hasPlatformBalanceDue(payout)) {
      const wallet = getWallet(payout);

      setErrorMessage(
        `Cannot mark payout as paid. This merchant has ${money(
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
      "Confirm that you have sent this payout to the merchant?"
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

      setSuccessMessage("Payout marked as paid.");
      fetchPayouts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to mark payout as paid.");
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
      "Reject this payout? The amount will be returned to merchant available balance."
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

      setSuccessMessage("Payout rejected and balance restored.");
      fetchPayouts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to reject payout.");
    } finally {
      setUpdatingId(null);
    }
  };

  const totals = useMemo(() => {
    return {
      pending: payouts
        .filter((payout) => payout.status === "pending")
        .reduce((acc, payout) => acc + Number(payout.amount || 0), 0),
      approved: payouts
        .filter((payout) => payout.status === "approved")
        .reduce((acc, payout) => acc + Number(payout.amount || 0), 0),
      paid: payouts
        .filter((payout) => payout.status === "paid")
        .reduce((acc, payout) => acc + Number(payout.amount || 0), 0),
      rejected: payouts
        .filter((payout) => payout.status === "rejected")
        .reduce((acc, payout) => acc + Number(payout.amount || 0), 0),
      platformBalanceDue: payouts.reduce((acc, payout) => {
        const wallet = getWallet(payout);
        return acc + Number(wallet?.platform_balance_due || 0);
      }, 0),
      blockedPayouts: payouts.filter(hasPlatformBalanceDue).length,
    };
  }, [payouts]);

  if (loading) {
    return <p className="text-slate-500">Loading payout approvals...</p>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="text-slate-500 mt-2">
          Only platform admins can access payout approvals.
        </p>

        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl mt-6">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Payout Approvals</h1>
        <p className="text-slate-500 mt-2">
          Review, approve, reject, and mark merchant payouts as paid.
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

      {totals.blockedPayouts > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5">
          <p className="font-semibold">Some payouts are blocked</p>
          <p className="text-sm mt-1">
            {totals.blockedPayouts} payout request(s) belong to merchants with
            platform balance due. Clear or resolve the due balance before
            approving or marking those payouts as paid.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <StatCard label="Pending" value={money(totals.pending)} />
        <StatCard label="Approved" value={money(totals.approved)} />
        <StatCard label="Paid" value={money(totals.paid)} />
        <StatCard label="Rejected" value={money(totals.rejected)} />
        <StatCard
          label="Platform Due"
          value={money(totals.platformBalanceDue)}
          tone={totals.platformBalanceDue > 0 ? "danger" : "normal"}
        />
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold">Payout Requests</h2>
            <p className="text-sm text-slate-500 mt-1">
              {payouts.length} payout request(s)
            </p>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {payouts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No payout requests found.
          </div>
        ) : (
          <div className="space-y-5">
            {payouts.map((payout) => {
              const tenant = getTenant(payout);
              const wallet = getWallet(payout);
              const isBlocked = hasPlatformBalanceDue(payout);

              return (
                <div
                  key={payout.id}
                  className={`border rounded-2xl p-5 ${isBlocked ? "border-red-200 bg-red-50/40" : ""
                    }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
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

                        {isBlocked && (
                          <span className="px-3 py-1 rounded-full text-xs bg-red-100 text-red-700">
                            Blocked: Platform Due
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-lg mt-3">
                        Payout #{payout.id.slice(0, 8)}
                      </h3>

                      <p className="text-sm text-slate-500 mt-1">
                        Store: {tenant?.name || "Unknown store"}
                      </p>

                      <p className="text-xs text-slate-400 mt-1">
                        Requested{" "}
                        {new Date(payout.requested_at).toLocaleString()}
                      </p>

                      <div className="mt-4 bg-white rounded-2xl p-4 text-sm border">
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
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="bg-slate-50 border rounded-xl p-3">
                            <p className="text-slate-500">Available</p>
                            <p className="font-semibold mt-1">
                              {money(
                                Number(wallet.available_balance || 0),
                                wallet.currency || payout.currency
                              )}
                            </p>
                          </div>

                          <div className="bg-slate-50 border rounded-xl p-3">
                            <p className="text-slate-500">Pending</p>
                            <p className="font-semibold mt-1">
                              {money(
                                Number(wallet.pending_balance || 0),
                                wallet.currency || payout.currency
                              )}
                            </p>
                          </div>

                          <div
                            className={`border rounded-xl p-3 ${Number(wallet.platform_balance_due || 0) > 0
                                ? "bg-red-50 border-red-200"
                                : "bg-slate-50"
                              }`}
                          >
                            <p
                              className={
                                Number(wallet.platform_balance_due || 0) > 0
                                  ? "text-red-600"
                                  : "text-slate-500"
                              }
                            >
                              Platform Due
                            </p>
                            <p
                              className={`font-semibold mt-1 ${Number(wallet.platform_balance_due || 0) > 0
                                  ? "text-red-700"
                                  : ""
                                }`}
                            >
                              {money(
                                Number(wallet.platform_balance_due || 0),
                                wallet.currency || payout.currency
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                      {payout.external_reference && (
                        <p className="text-xs text-slate-500 mt-3">
                          Reference: {payout.external_reference}
                        </p>
                      )}

                      {payout.rejection_reason && (
                        <p className="text-xs text-red-600 mt-3">
                          Rejection reason: {payout.rejection_reason}
                        </p>
                      )}

                      {payout.admin_note && (
                        <p className="text-xs text-slate-500 mt-3">
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
                              className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100 disabled:opacity-50"
                            >
                              Approve
                            </button>

                            <button
                              onClick={() => rejectPayout(payout.id)}
                              disabled={updatingId === payout.id}
                              className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-600 disabled:opacity-50"
                            >
                              Reject
                            </button>

                            <button
                              onClick={() => markPaid(payout)}
                              disabled={updatingId === payout.id || isBlocked}
                              className="bg-black text-white px-4 py-2 rounded-xl text-sm hover:opacity-90 disabled:opacity-50"
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
                              className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-600 disabled:opacity-50"
                            >
                              Reject
                            </button>

                            <button
                              onClick={() => markPaid(payout)}
                              disabled={updatingId === payout.id || isBlocked}
                              className="bg-black text-white px-4 py-2 rounded-xl text-sm hover:opacity-90 disabled:opacity-50"
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
                        <p className="text-xs text-red-600 mt-3 max-w-xs">
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
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string | number;
  tone?: "normal" | "danger";
}) {
  return (
    <div
      className={`rounded-2xl shadow p-6 ${tone === "danger" ? "bg-red-50 border border-red-200" : "bg-white"
        }`}
    >
      <p
        className={`text-sm ${tone === "danger" ? "text-red-600" : "text-slate-500"
          }`}
      >
        {label}
      </p>

      <h2
        className={`text-3xl font-bold mt-2 ${tone === "danger" ? "text-red-700" : ""
          }`}
      >
        {value}
      </h2>
    </div>
  );
}