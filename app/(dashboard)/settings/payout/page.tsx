"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TenantPayoutSetup = {
  id: string;
  name: string;
  slug: string;
  currency: string | null;

  paystack_subaccount_code: string | null;
  paystack_business_name: string | null;
  paystack_country: string | null;
  paystack_bank_code: string | null;
  paystack_bank_name: string | null;
  paystack_account_number: string | null;
  paystack_account_name: string | null;
  paystack_settlement_currency: string | null;

  platform_commission_percentage: number | null;
  payment_fee_bearer: "merchant" | "platform" | null;

  payout_setup_status:
    | "not_started"
    | "pending"
    | "active"
    | "failed"
    | "disabled";
  payout_setup_error: string | null;
  payout_setup_updated_at: string | null;
};

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}

function normalizeCountry(value: string) {
  return value.trim().toUpperCase();
}

function maskAccount(value: string | null) {
  if (!value) return "Not provided";
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not updated yet";
  return new Date(value).toLocaleString();
}

function statusClass(status: string) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "pending") return "bg-yellow-100 text-yellow-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  if (status === "disabled") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-600";
}

export default function PayoutSettingsPage() {
  const supabase = createClient();

  const [tenant, setTenant] = useState<TenantPayoutSetup | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [countryCode, setCountryCode] = useState("GH");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [settlementCurrency, setSettlementCurrency] = useState("GHS");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const setupStatus = tenant?.payout_setup_status || "not_started";
  const commission = Number(tenant?.platform_commission_percentage || 5);
  const feeBearer = tenant?.payment_fee_bearer || "merchant";

  const settlementReady = useMemo(() => {
    return Boolean(
      businessName.trim() &&
        /^[A-Z]{2}$/.test(normalizeCountry(countryCode)) &&
        bankName.trim() &&
        bankCode.trim() &&
        accountNumber.trim() &&
        accountName.trim() &&
        /^[A-Z]{3}$/.test(normalizeCurrency(settlementCurrency))
    );
  }, [
    businessName,
    countryCode,
    bankName,
    bankCode,
    accountNumber,
    accountName,
    settlementCurrency,
  ]);

  const fetchSetup = async (preserveMessages = false) => {
    try {
      setLoading(true);

      if (!preserveMessages) {
        setErrorMessage("");
        setSuccessMessage("");
      }

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
        setErrorMessage("You do not have permission to manage settlement setup.");
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
          paystack_business_name,
          paystack_country,
          paystack_bank_code,
          paystack_bank_name,
          paystack_account_number,
          paystack_account_name,
          paystack_settlement_currency,
          platform_commission_percentage,
          payment_fee_bearer,
          payout_setup_status,
          payout_setup_error,
          payout_setup_updated_at
        `)
        .eq("id", profile.tenant_id)
        .maybeSingle();

      if (tenantError || !tenantData) {
        setErrorMessage(tenantError?.message || "Store not found.");
        return;
      }

      const loadedTenant = tenantData as TenantPayoutSetup;
      setTenant(loadedTenant);

      setBusinessName(loadedTenant.paystack_business_name || loadedTenant.name || "");
      setCountryCode(normalizeCountry(loadedTenant.paystack_country || "GH"));
      setBankName(loadedTenant.paystack_bank_name || "");
      setBankCode(loadedTenant.paystack_bank_code || "");
      setAccountNumber(loadedTenant.paystack_account_number || "");
      setAccountName(loadedTenant.paystack_account_name || "");
      setSettlementCurrency(
        normalizeCurrency(
          loadedTenant.paystack_settlement_currency ||
            loadedTenant.currency ||
            "GHS"
        )
      );
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load settlement setup.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateForm = () => {
    if (!tenant) {
      setErrorMessage("Store not found.");
      return false;
    }

    if (!businessName.trim()) {
      setErrorMessage("Business name is required.");
      return false;
    }

    if (!/^[A-Z]{2}$/.test(normalizeCountry(countryCode))) {
      setErrorMessage(
        "Country code must be a valid 2-letter code, like GH, NG, KE, ZA, or US."
      );
      return false;
    }

    if (!bankName.trim()) {
      setErrorMessage("Bank name is required.");
      return false;
    }

    if (!bankCode.trim()) {
      setErrorMessage("Bank code is required.");
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

    if (!/^[A-Z]{3}$/.test(normalizeCurrency(settlementCurrency))) {
      setErrorMessage(
        "Settlement currency must be a valid 3-letter currency code, like GHS, NGN, KES, ZAR, or USD."
      );
      return false;
    }

    return true;
  };

  const handleSaveSetup = async () => {
    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!validateForm()) return;

      const { data, error } = await supabase.rpc(
        "update_my_paystack_payout_setup",
        {
          p_business_name: businessName.trim(),
          p_bank_code: bankCode.trim(),
          p_bank_name: bankName.trim(),
          p_account_number: accountNumber.trim(),
          p_account_name: accountName.trim(),
          p_country: normalizeCountry(countryCode),
          p_settlement_currency: normalizeCurrency(settlementCurrency),
        }
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        setTenant(data as TenantPayoutSetup);
      }

      setSuccessMessage(
        "Settlement details saved. You can now activate Paystack settlement."
      );

      await fetchSetup(true);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to save settlement setup.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubaccount = async () => {
    try {
      setCreatingSubaccount(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!validateForm()) return;

      if (setupStatus === "not_started") {
        setErrorMessage("Save your settlement details before activating Paystack.");
        return;
      }

      const response = await fetch("/api/paystack/subaccount/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error || "Failed to activate Paystack settlement."
        );
        await fetchSetup(true);
        return;
      }

      setSuccessMessage(
        "Paystack settlement activated successfully. Customer payments can now be split automatically."
      );

      await fetchSetup(true);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to activate Paystack settlement.");
    } finally {
      setCreatingSubaccount(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-500">Loading settlement setup...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">
          Settlement setup unavailable
        </h1>
        <p className="mt-2 text-slate-500">
          {errorMessage || "Could not load your store settlement setup."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%)]" />

        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
          <div className="lg:col-span-2">
            <a href="/wallet" className="text-sm text-slate-300 hover:text-white">
              ← Back to Wallet
            </a>

            <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Global Paystack split settlement
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
              Set up direct merchant settlement.
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              Add your country, currency, and bank details so customer payments
              can be split automatically. StoreForge keeps the platform fee, and
              your merchant share is settled through your Paystack subaccount.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <InfoBadge label="Platform fee" value={`${commission}%`} />
              <InfoBadge
                label="Payment fee bearer"
                value={feeBearer === "merchant" ? "Merchant" : "StoreForge"}
              />
              <InfoBadge
                label="Settlement currency"
                value={settlementCurrency || "GHS"}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <p className="text-sm text-slate-300">Setup status</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${statusClass(
                  setupStatus
                )}`}
              >
                {setupStatus.replaceAll("_", " ")}
              </span>

              {tenant.paystack_subaccount_code && (
                <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                  Subaccount linked
                </span>
              )}
            </div>

            <div className="mt-5 rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Paystack subaccount
              </p>
              <p className="mt-2 break-all text-sm font-semibold">
                {tenant.paystack_subaccount_code || "Not created yet"}
              </p>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-400">
              Last updated: {formatDate(tenant.payout_setup_updated_at)}
            </p>
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

      {tenant.payout_setup_error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-semibold">Paystack setup error</p>
          <p className="mt-1 text-sm">{tenant.payout_setup_error}</p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-8 xl:col-span-2">
          <Panel
            title="Settlement account"
            description="Use the country and bank details supported by Paystack for your location. Bank codes vary by country, so enter the correct code for your bank."
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Business name">
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="Example: Tech World"
                  className="field-input"
                />
              </Field>

              <Field label="Country code">
                <input
                  value={countryCode}
                  onChange={(event) =>
                    setCountryCode(normalizeCountry(event.target.value))
                  }
                  placeholder="GH, NG, KE, ZA, US"
                  maxLength={2}
                  className="field-input uppercase"
                />
              </Field>

              <Field label="Settlement currency">
                <input
                  value={settlementCurrency}
                  onChange={(event) =>
                    setSettlementCurrency(normalizeCurrency(event.target.value))
                  }
                  placeholder="GHS, NGN, KES, ZAR, USD"
                  maxLength={3}
                  className="field-input uppercase"
                />
              </Field>

              <Field label="Bank name">
                <input
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                  placeholder="Bank name"
                  className="field-input"
                />
              </Field>

              <Field label="Bank code">
                <input
                  value={bankCode}
                  onChange={(event) => setBankCode(event.target.value)}
                  placeholder="Bank code from Paystack"
                  className="field-input"
                />
              </Field>

              <Field label="Account number">
                <input
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  placeholder="Account number"
                  className="field-input"
                />
              </Field>

              <Field label="Account name">
                <input
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="Account name"
                  className="field-input md:col-span-2"
                />
              </Field>
            </div>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              <strong>Note:</strong> Bank codes are different in every country.
              For now, enter the bank code manually. Later, we can add a dynamic
              “Load banks by country” feature using Paystack’s bank list API.
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleSaveSetup}
                disabled={saving}
                className="rounded-2xl bg-slate-950 px-6 py-4 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save settlement details"}
              </button>

              <button
                onClick={handleCreateSubaccount}
                disabled={
                  creatingSubaccount ||
                  saving ||
                  !settlementReady ||
                  setupStatus === "not_started"
                }
                className="rounded-2xl bg-blue-600 px-6 py-4 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creatingSubaccount
                  ? "Activating..."
                  : tenant.paystack_subaccount_code
                  ? "Refresh Paystack subaccount"
                  : "Activate Paystack settlement"}
              </button>
            </div>

            {setupStatus === "not_started" && (
              <p className="mt-4 text-sm text-yellow-700">
                Save your settlement details first. After saving, activate
                Paystack settlement to create your subaccount.
              </p>
            )}
          </Panel>

          <Panel
            title="How split settlement works"
            description="This keeps merchants in control while StoreForge still earns its platform fee."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ExplainerCard
                step="1"
                title="Customer pays"
                text="The customer pays the full order amount at checkout."
              />
              <ExplainerCard
                step="2"
                title="Fees are applied"
                text={`StoreForge keeps ${commission}% platform fee. Paystack processing fees are borne by the ${feeBearer}.`}
              />
              <ExplainerCard
                step="3"
                title="Merchant settles"
                text="Your merchant share is settled through your Paystack subaccount."
              />
            </div>
          </Panel>
        </div>

        <aside className="space-y-8">
          <Panel title="Current setup">
            <div className="space-y-4 text-sm">
              <SetupRow label="Store" value={tenant.name} />
              <SetupRow label="Store currency" value={tenant.currency || "GHS"} />
              <SetupRow label="Country" value={tenant.paystack_country || countryCode} />
              <SetupRow
                label="Settlement currency"
                value={tenant.paystack_settlement_currency || settlementCurrency}
              />
              <SetupRow
                label="Business name"
                value={tenant.paystack_business_name || "Not provided"}
              />
              <SetupRow
                label="Bank"
                value={tenant.paystack_bank_name || "Not provided"}
              />
              <SetupRow
                label="Bank code"
                value={tenant.paystack_bank_code || "Not provided"}
              />
              <SetupRow
                label="Account"
                value={maskAccount(tenant.paystack_account_number)}
              />
              <SetupRow
                label="Account name"
                value={tenant.paystack_account_name || "Not provided"}
              />
              <SetupRow
                label="Subaccount"
                value={tenant.paystack_subaccount_code || "Not created"}
              />
            </div>
          </Panel>

          <Panel title="Settlement policy">
            <div className="space-y-4 text-sm text-slate-600">
              <PolicyItem
                title="Platform fee"
                text={`StoreForge charges ${commission}% on successful orders.`}
              />

              <PolicyItem
                title="Processing fee"
                text={
                  feeBearer === "merchant"
                    ? "Paystack processing fees are deducted from the merchant settlement."
                    : "StoreForge bears Paystack processing fees."
                }
              />

              <PolicyItem
                title="Global merchants"
                text="Merchants can enter the country, currency, bank name, and Paystack bank code that apply to their location."
              />

              <PolicyItem
                title="Fallback payouts"
                text="Manual payout requests may still be used for failed settlements, adjustments, or special cases."
              />
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 font-bold text-white">{value}</p>
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
        <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
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

function ExplainerCard({
  step,
  title,
  text,
}: {
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
        {step}
      </div>
      <h3 className="mt-4 font-bold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
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

function PolicyItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 leading-6">{text}</p>
    </div>
  );
}