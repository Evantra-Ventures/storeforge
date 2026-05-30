"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PayoutAccount = {
  id: string;
  tenant_id: string;
  payout_method: "bank" | "mobile_money";
  bank_name: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_name: string | null;
  momo_provider: string | null;
  momo_number: string | null;
  momo_name: string | null;
  country: string;
  currency: string;
  is_default: boolean;
  status: string;
  created_at: string;
};

export default function PayoutSettingsPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [payoutMethod, setPayoutMethod] = useState<"bank" | "mobile_money">(
    "bank"
  );

  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [momoProvider, setMomoProvider] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");

  const [country, setCountry] = useState("GH");
  const [currency, setCurrency] = useState("GHS");
  const [isDefault, setIsDefault] = useState(true);
  const [status, setStatus] = useState("active");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setPayoutMethod("bank");
    setBankName("");
    setBankCode("");
    setAccountNumber("");
    setAccountName("");
    setMomoProvider("");
    setMomoNumber("");
    setMomoName("");
    setCountry("GH");
    setCurrency("GHS");
    setIsDefault(true);
    setStatus("active");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const fetchAccounts = async () => {
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

      setTenantId(profile.tenant_id);

      const { data, error } = await supabase
        .from("tenant_payout_accounts")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setAccounts(data || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load payout accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const validateForm = () => {
    if (!tenantId) {
      setErrorMessage("Tenant not found.");
      return false;
    }

    if (payoutMethod === "bank") {
      if (!bankName.trim()) {
        setErrorMessage("Bank name is required.");
        return false;
      }

      if (!accountNumber.trim()) {
        setErrorMessage("Account number is required.");
        return false;
      }

      if (!accountName.trim()) {
        setErrorMessage("Account name is required.");
        return false;
      }
    }

    if (payoutMethod === "mobile_money") {
      if (!momoProvider.trim()) {
        setErrorMessage("Mobile money provider is required.");
        return false;
      }

      if (!momoNumber.trim()) {
        setErrorMessage("Mobile money number is required.");
        return false;
      }

      if (!momoName.trim()) {
        setErrorMessage("Mobile money account name is required.");
        return false;
      }
    }

    return true;
  };

  const unsetOtherDefaultAccounts = async () => {
    if (!tenantId || !isDefault) return;

    await supabase
      .from("tenant_payout_accounts")
      .update({ is_default: false })
      .eq("tenant_id", tenantId);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!validateForm() || !tenantId) return;

      await unsetOtherDefaultAccounts();

      const payload = {
        tenant_id: tenantId,
        payout_method: payoutMethod,

        bank_name: payoutMethod === "bank" ? bankName : null,
        bank_code: payoutMethod === "bank" ? bankCode || null : null,
        account_number: payoutMethod === "bank" ? accountNumber : null,
        account_name: payoutMethod === "bank" ? accountName : null,

        momo_provider:
          payoutMethod === "mobile_money" ? momoProvider : null,
        momo_number: payoutMethod === "mobile_money" ? momoNumber : null,
        momo_name: payoutMethod === "mobile_money" ? momoName : null,

        country,
        currency,
        is_default: isDefault,
        status,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("tenant_payout_accounts")
          .update(payload)
          .eq("id", editingId)
          .eq("tenant_id", tenantId);

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setSuccessMessage("Payout account updated successfully.");
      } else {
        const { error } = await supabase
          .from("tenant_payout_accounts")
          .insert(payload);

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setSuccessMessage("Payout account added successfully.");
      }

      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to save payout account.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (account: PayoutAccount) => {
    setEditingId(account.id);
    setPayoutMethod(account.payout_method);

    setBankName(account.bank_name || "");
    setBankCode(account.bank_code || "");
    setAccountNumber(account.account_number || "");
    setAccountName(account.account_name || "");

    setMomoProvider(account.momo_provider || "");
    setMomoNumber(account.momo_number || "");
    setMomoName(account.momo_name || "");

    setCountry(account.country || "GH");
    setCurrency(account.currency || "GHS");
    setIsDefault(account.is_default);
    setStatus(account.status || "active");

    setErrorMessage("");
    setSuccessMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSetDefault = async (accountId: string) => {
    if (!tenantId) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");

      await supabase
        .from("tenant_payout_accounts")
        .update({ is_default: false })
        .eq("tenant_id", tenantId);

      const { error } = await supabase
        .from("tenant_payout_accounts")
        .update({
          is_default: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Default payout account updated.");
      fetchAccounts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update default payout account.");
    }
  };

  const handleDeactivate = async (accountId: string) => {
    if (!tenantId) return;

    const confirmed = confirm("Deactivate this payout account?");
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("tenant_payout_accounts")
        .update({
          status: "inactive",
          is_default: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Payout account deactivated.");
      fetchAccounts();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to deactivate payout account.");
    }
  };

  const maskAccount = (value: string | null) => {
    if (!value) return "Not provided";
    if (value.length <= 4) return value;
    return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
  };

  return (
    <div className="space-y-8">
      <div>
        <a href="/wallet" className="text-sm text-slate-500 hover:text-black">
          ← Back to Wallet
        </a>

        <h1 className="text-3xl font-bold mt-4">Payout Settings</h1>
        <p className="text-slate-500 mt-2">
          Add bank or mobile money details for merchant payout requests.
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

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {editingId ? "Edit Payout Account" : "Add Payout Account"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Merchants can receive payouts through bank transfer or mobile
              money.
            </p>
          </div>

          {editingId && (
            <button
              onClick={resetForm}
              className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="border rounded-xl p-4 flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              checked={payoutMethod === "bank"}
              onChange={() => setPayoutMethod("bank")}
            />
            <div>
              <p className="font-medium">Bank Account</p>
              <p className="text-xs text-slate-500">
                Receive payouts to a bank account.
              </p>
            </div>
          </label>

          <label className="border rounded-xl p-4 flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              checked={payoutMethod === "mobile_money"}
              onChange={() => setPayoutMethod("mobile_money")}
            />
            <div>
              <p className="font-medium">Mobile Money</p>
              <p className="text-xs text-slate-500">
                Receive payouts to a MoMo account.
              </p>
            </div>
          </label>
        </div>

        {payoutMethod === "bank" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank name"
              className="border rounded-xl p-3"
            />

            <input
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              placeholder="Bank code optional"
              className="border rounded-xl p-3"
            />

            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Account number"
              className="border rounded-xl p-3"
            />

            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Account name"
              className="border rounded-xl p-3"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={momoProvider}
              onChange={(e) => setMomoProvider(e.target.value)}
              className="border rounded-xl p-3"
            >
              <option value="">Select provider</option>
              <option value="MTN Mobile Money">MTN Mobile Money</option>
              <option value="Vodafone Cash">Vodafone Cash</option>
              <option value="AirtelTigo Money">AirtelTigo Money</option>
              <option value="Other">Other</option>
            </select>

            <input
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              placeholder="Mobile money number"
              className="border rounded-xl p-3"
            />

            <input
              value={momoName}
              onChange={(e) => setMomoName(e.target.value)}
              placeholder="Mobile money account name"
              className="border rounded-xl p-3"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            className="border rounded-xl p-3"
          />

          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="Currency"
            className="border rounded-xl p-3"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="rejected">Rejected</option>
          </select>

          <label className="border rounded-xl p-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Default payout account
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : editingId
              ? "Update Payout Account"
              : "Save Payout Account"}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Saved Payout Accounts</h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage your payout destinations.
            </p>
          </div>

          <span className="text-sm text-slate-500">
            {accounts.length} account(s)
          </span>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading payout accounts...</p>
        ) : accounts.length === 0 ? (
          <div className="bg-slate-50 border rounded-2xl p-8 text-center">
            <h3 className="font-semibold">No payout account yet</h3>
            <p className="text-slate-500 mt-2">
              Add a bank account or mobile money number before requesting
              payouts.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">
                      {account.payout_method.replaceAll("_", " ")}
                    </span>

                    <span
                      className={`px-3 py-1 rounded-full text-xs capitalize ${
                        account.status === "active"
                          ? "bg-green-100 text-green-700"
                          : account.status === "pending_verification"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {account.status.replaceAll("_", " ")}
                    </span>

                    {account.is_default && (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                        Default
                      </span>
                    )}
                  </div>

                  {account.payout_method === "bank" ? (
                    <div className="mt-3">
                      <h3 className="font-semibold">
                        {account.account_name || "Bank Account"}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {account.bank_name || "Bank"} ·{" "}
                        {maskAccount(account.account_number)}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <h3 className="font-semibold">
                        {account.momo_name || "Mobile Money Account"}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {account.momo_provider || "MoMo"} ·{" "}
                        {maskAccount(account.momo_number)}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-2">
                    {account.country} · {account.currency}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {!account.is_default && account.status === "active" && (
                    <button
                      onClick={() => handleSetDefault(account.id)}
                      className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
                    >
                      Set Default
                    </button>
                  )}

                  <button
                    onClick={() => handleEdit(account)}
                    className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
                  >
                    Edit
                  </button>

                  {account.status === "active" && (
                    <button
                      onClick={() => handleDeactivate(account.id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-600"
                    >
                      Deactivate
                    </button>
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