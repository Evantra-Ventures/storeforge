import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PaystackSubaccountResponse = {
  status: boolean;
  message: string;
  data?: {
    id?: number;
    subaccount_code?: string;
    business_name?: string;
    account_number?: string;
    account_name?: string;
    settlement_bank?: string;
    percentage_charge?: number;
    currency?: string;
    active?: boolean;
    is_verified?: boolean;
    [key: string]: any;
  };
};

function normalizeCountry(value?: string | null) {
  const normalized = (value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
}

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "";
}

function cleanText(value?: string | null) {
  return (value || "").trim();
}

function getPaystackErrorMessage(data: any) {
  if (!data) return "Paystack request failed.";
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  return "Paystack request failed.";
}

export async function POST() {
  try {
    const supabase = createClient();

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        { error: "Paystack secret key is not configured." },
        { status: 500 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message || "Failed to load profile." },
        { status: 400 }
      );
    }

    if (!profile?.tenant_id) {
      return NextResponse.json(
        { error: "Tenant profile not found." },
        { status: 404 }
      );
    }

    if (!["store_owner", "owner", "super_admin"].includes(profile.role || "")) {
      return NextResponse.json(
        { error: "You do not have permission to manage settlement setup." },
        { status: 403 }
      );
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select(`
        id,
        name,
        slug,
        contact_email,
        support_phone,
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
        payout_setup_status
      `)
      .eq("id", profile.tenant_id)
      .maybeSingle();

    if (tenantError) {
      return NextResponse.json(
        { error: tenantError.message || "Failed to load store." },
        { status: 400 }
      );
    }

    if (!tenant) {
      return NextResponse.json({ error: "Store not found." }, { status: 404 });
    }

    const businessName = cleanText(
      tenant.paystack_business_name || tenant.name
    );
    const bankCode = cleanText(tenant.paystack_bank_code);
    const bankName = cleanText(tenant.paystack_bank_name);
    const accountNumber = cleanText(tenant.paystack_account_number);
    const accountName = cleanText(tenant.paystack_account_name);

    const country = normalizeCountry(tenant.paystack_country || "GH");
    const currency = normalizeCurrency(
      tenant.paystack_settlement_currency || tenant.currency || "GHS"
    );

    const platformCommissionPercentage = Number(
      tenant.platform_commission_percentage ?? 5
    );

    if (!businessName) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 }
      );
    }

    if (!country) {
      return NextResponse.json(
        { error: "A valid 2-letter country code is required." },
        { status: 400 }
      );
    }

    if (!currency) {
      return NextResponse.json(
        { error: "A valid 3-letter settlement currency is required." },
        { status: 400 }
      );
    }

    if (!bankCode) {
      return NextResponse.json(
        { error: "Bank code is required." },
        { status: 400 }
      );
    }

    if (!bankName) {
      return NextResponse.json(
        { error: "Bank name is required." },
        { status: 400 }
      );
    }

    if (!accountNumber) {
      return NextResponse.json(
        { error: "Account number is required." },
        { status: 400 }
      );
    }

    if (!accountName) {
      return NextResponse.json(
        { error: "Account name is required." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(platformCommissionPercentage) ||
      platformCommissionPercentage < 0 ||
      platformCommissionPercentage > 100
    ) {
      return NextResponse.json(
        { error: "Invalid platform commission percentage." },
        { status: 400 }
      );
    }

    const subaccountPayload = {
      business_name: businessName,
      settlement_bank: bankCode,
      account_number: accountNumber,
      percentage_charge: platformCommissionPercentage,
      description: `${tenant.name} settlement subaccount on StoreForge`,
      primary_contact_email: tenant.contact_email || user.email || undefined,
      primary_contact_name: accountName || businessName,
      primary_contact_phone: tenant.support_phone || undefined,
      metadata: JSON.stringify({
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        store_name: tenant.name,
        country,
        currency,
        bank_name: bankName,
        account_name: accountName,
        platform: "StoreForge",
      }),
    };

    const existingSubaccountCode = cleanText(tenant.paystack_subaccount_code);

    const paystackUrl = existingSubaccountCode
      ? `https://api.paystack.co/subaccount/${encodeURIComponent(
          existingSubaccountCode
        )}`
      : "https://api.paystack.co/subaccount";

    const paystackMethod = existingSubaccountCode ? "PUT" : "POST";

    const response = await fetch(paystackUrl, {
      method: paystackMethod,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subaccountPayload),
    });

    const paystackData =
      (await response.json()) as PaystackSubaccountResponse | any;

    if (!response.ok || !paystackData.status) {
      const errorMessage = getPaystackErrorMessage(paystackData);

      await supabase.rpc("set_tenant_paystack_subaccount", {
        p_tenant_id: tenant.id,
        p_subaccount_code: existingSubaccountCode || "",
        p_status: "failed",
        p_error: errorMessage,
      });

      return NextResponse.json(
        {
          error: errorMessage,
          paystack_status: response.status,
          details: paystackData,
        },
        { status: 400 }
      );
    }

    const subaccountCode =
      paystackData.data?.subaccount_code || existingSubaccountCode;

    if (!subaccountCode) {
      const errorMessage =
        "Paystack did not return a subaccount code. Please try again.";

      await supabase.rpc("set_tenant_paystack_subaccount", {
        p_tenant_id: tenant.id,
        p_subaccount_code: existingSubaccountCode || "",
        p_status: "failed",
        p_error: errorMessage,
      });

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { data: updatedTenant, error: saveError } = await supabase.rpc(
      "set_tenant_paystack_subaccount",
      {
        p_tenant_id: tenant.id,
        p_subaccount_code: subaccountCode,
        p_status: "active",
        p_error: null,
      }
    );

    if (saveError) {
      return NextResponse.json(
        {
          error:
            saveError.message ||
            "Paystack subaccount was created, but could not be saved.",
          subaccount_code: subaccountCode,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: existingSubaccountCode
        ? "Paystack subaccount updated successfully."
        : "Paystack subaccount created successfully.",
      subaccountCode,
      tenant: updatedTenant,
      paystack: {
        business_name: paystackData.data?.business_name,
        account_name: paystackData.data?.account_name,
        account_number: paystackData.data?.account_number,
        settlement_bank: paystackData.data?.settlement_bank,
        percentage_charge: paystackData.data?.percentage_charge,
        currency: paystackData.data?.currency,
        active: paystackData.data?.active,
        is_verified: paystackData.data?.is_verified,
      },
    });
  } catch (error) {
    console.error("Paystack subaccount setup failed:", error);

    return NextResponse.json(
      { error: "Paystack subaccount setup failed." },
      { status: 500 }
    );
  }
}