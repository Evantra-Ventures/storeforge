"use client";

import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CustomerProfile = {
  id: string;
  tenant_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  marketing_email_opt_in: boolean;
  marketing_sms_opt_in: boolean;
  marketing_whatsapp_opt_in: boolean;
  default_address_id: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  status: string;
};

type CustomerAddress = {
  id: string;
  tenant_id: string;
  customer_profile_id: string;
  user_id: string;
  label: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  area: string | null;
  city: string | null;
  region: string | null;
  country: string;
  postal_code: string | null;
  delivery_instructions: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  status: string;
  created_at: string;
};

type LoyaltyAccount = {
  id: string;
  tenant_id: string;
  customer_profile_id: string;
  user_id: string;
  points_balance: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  lifetime_points_expired: number;
  tier_name: string;
  status: string;
};

type LoyaltySettings = {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  reward_name: string;
  reward_currency_label: string;
  currency_per_point: number;
  minimum_points_to_redeem: number;
};

type ProfileTenantOption = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  currency: string | null;
};

export default function CustomerProfilePage() {
  const supabase = createClient();
  const router = useRouter();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [tenantOptions, setTenantOptions] = useState<ProfileTenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] =
    useState<ProfileTenantOption | null>(null);

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  const [loyaltyAccount, setLoyaltyAccount] =
    useState<LoyaltyAccount | null>(null);
  const [loyaltySettings, setLoyaltySettings] =
    useState<LoyaltySettings | null>(null);

  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const [marketingEmail, setMarketingEmail] = useState(false);
  const [marketingSms, setMarketingSms] = useState(false);
  const [marketingWhatsapp, setMarketingWhatsapp] = useState(false);

  const [label, setLabel] = useState("Home");
  const [addressFullName, setAddressFullName] = useState("");
  const [addressPhone, setAddressPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("Ghana");
  const [postalCode, setPostalCode] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const currency = selectedTenant?.currency || "GHS";

  const money = (value: number) =>
    `${currency} ${Number(value || 0).toFixed(2)}`;

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setLabel("Home");
    setAddressFullName("");
    setAddressPhone("");
    setAddressLine1("");
    setAddressLine2("");
    setArea("");
    setCity("");
    setRegion("");
    setCountry("Ghana");
    setPostalCode("");
    setDeliveryInstructions("");
    setIsDefault(false);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const resolveTenantForProfile = async (userIdValue: string) => {
    const searchParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

    const tenantParam = searchParams.get("tenant");
    const storeParam = searchParams.get("store");

    let resolvedTenant: ProfileTenantOption | null = null;
    const tenantMap = new Map<string, ProfileTenantOption>();

    const addTenant = (tenant: any) => {
      if (!tenant?.id) return;

      tenantMap.set(tenant.id, {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url || null,
        currency: tenant.currency || null,
      });
    };

    if (storeParam) {
      const { data } = await supabase
        .from("tenants")
        .select("id,name,slug,logo_url,currency")
        .eq("slug", storeParam)
        .maybeSingle();

      if (data) resolvedTenant = data;
    }

    if (!resolvedTenant && tenantParam) {
      const { data } = await supabase
        .from("tenants")
        .select("id,name,slug,logo_url,currency")
        .eq("id", tenantParam)
        .maybeSingle();

      if (data) resolvedTenant = data;
    }

    if (!resolvedTenant && typeof window !== "undefined") {
      const lastStoreSlug = window.localStorage.getItem(
        "storeforge:last_profile_store"
      );

      if (lastStoreSlug) {
        const { data } = await supabase
          .from("tenants")
          .select("id,name,slug,logo_url,currency")
          .eq("slug", lastStoreSlug)
          .maybeSingle();

        if (data) resolvedTenant = data;
      }
    }

    const { data: profileTenants } = await supabase
      .from("customer_profiles")
      .select(`
        tenant:tenants (
          id,
          name,
          slug,
          logo_url,
          currency
        )
      `)
      .eq("user_id", userIdValue)
      .order("created_at", { ascending: false })
      .limit(20);

    (profileTenants || []).forEach((row: any) => {
      const tenant = Array.isArray(row.tenant) ? row.tenant[0] : row.tenant;
      addTenant(tenant);
    });

    const { data: orderTenants } = await supabase
      .from("orders")
      .select(`
        tenant:tenants (
          id,
          name,
          slug,
          logo_url,
          currency
        )
      `)
      .eq("customer_id", userIdValue)
      .order("created_at", { ascending: false })
      .limit(10);

    (orderTenants || []).forEach((row: any) => {
      const tenant = Array.isArray(row.tenant) ? row.tenant[0] : row.tenant;
      addTenant(tenant);
    });

    const { data: wishlistTenants } = await supabase
      .from("wishlists")
      .select(`
        product:products (
          tenant:tenants (
            id,
            name,
            slug,
            logo_url,
            currency
          )
        )
      `)
      .eq("customer_id", userIdValue)
      .order("created_at", { ascending: false })
      .limit(10);

    (wishlistTenants || []).forEach((row: any) => {
      const product = Array.isArray(row.product) ? row.product[0] : row.product;
      const tenant = Array.isArray(product?.tenant)
        ? product.tenant[0]
        : product?.tenant;

      addTenant(tenant);
    });

    const { data: addressTenants } = await supabase
      .from("customer_addresses")
      .select(`
        tenant:tenants (
          id,
          name,
          slug,
          logo_url,
          currency
        )
      `)
      .eq("user_id", userIdValue)
      .order("created_at", { ascending: false })
      .limit(10);

    (addressTenants || []).forEach((row: any) => {
      const tenant = Array.isArray(row.tenant) ? row.tenant[0] : row.tenant;
      addTenant(tenant);
    });

    if (resolvedTenant?.id) {
      tenantMap.set(resolvedTenant.id, resolvedTenant);
    }

    const options = Array.from(tenantMap.values());

    setTenantOptions(options);

    if (!resolvedTenant && options.length > 0) {
      resolvedTenant = options[0];
    }

    if (resolvedTenant && typeof window !== "undefined") {
      window.localStorage.setItem(
        "storeforge:last_profile_store",
        resolvedTenant.slug
      );
    }

    return resolvedTenant;
  };

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const currentPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/customer/profile";

        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
        return;
      }

      setUserId(user.id);

      const resolvedTenant = await resolveTenantForProfile(user.id);

      if (!resolvedTenant) {
        setTenantId(null);
        setSelectedTenant(null);
        setErrorMessage(
          "Choose a store first. Customer profiles, addresses, and rewards are tracked separately for each merchant."
        );
        return;
      }

      setTenantId(resolvedTenant.id);
      setSelectedTenant(resolvedTenant);

      const { data: ensuredProfileId, error: ensureError } = await supabase.rpc(
        "ensure_customer_profile",
        {
          p_tenant_id: resolvedTenant.id,
          p_user_id: user.id,
          p_full_name:
            user.user_metadata?.full_name || user.user_metadata?.name || null,
          p_email: user.email || null,
          p_phone: user.phone || null,
        }
      );

      if (ensureError || !ensuredProfileId) {
        setErrorMessage(ensureError?.message || "Customer profile not found.");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("id", ensuredProfileId)
        .single();

      if (profileError || !profileData) {
        setErrorMessage(profileError?.message || "Customer profile not found.");
        return;
      }

      setProfile(profileData);

      setFullName(profileData.full_name || "");
      setEmail(profileData.email || "");
      setPhone(profileData.phone || "");
      setDateOfBirth(profileData.date_of_birth || "");
      setMarketingEmail(profileData.marketing_email_opt_in || false);
      setMarketingSms(profileData.marketing_sms_opt_in || false);
      setMarketingWhatsapp(profileData.marketing_whatsapp_opt_in || false);

      const { data: addressData, error: addressError } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("tenant_id", resolvedTenant.id)
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (addressError) {
        setErrorMessage(addressError.message);
        return;
      }

      setAddresses(addressData || []);

      await supabase.rpc("ensure_loyalty_settings", {
        p_tenant_id: resolvedTenant.id,
      });

      const { data: settingsData } = await supabase
        .from("loyalty_settings")
        .select(`
          id,
          tenant_id,
          is_enabled,
          reward_name,
          reward_currency_label,
          currency_per_point,
          minimum_points_to_redeem
        `)
        .eq("tenant_id", resolvedTenant.id)
        .maybeSingle();

      setLoyaltySettings(settingsData || null);

      if (profileData?.id) {
        const { data: loyaltyAccountId } = await supabase.rpc(
          "ensure_customer_loyalty_account",
          {
            p_tenant_id: resolvedTenant.id,
            p_customer_profile_id: profileData.id,
            p_user_id: user.id,
          }
        );

        if (loyaltyAccountId) {
          const { data: accountData } = await supabase
            .from("customer_loyalty_accounts")
            .select("*")
            .eq("id", loyaltyAccountId)
            .maybeSingle();

          setLoyaltyAccount(accountData || null);
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load customer profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStoreChange = (slug: string) => {
    const tenant = tenantOptions.find((item) => item.slug === slug);

    if (!tenant) return;

    if (typeof window !== "undefined") {
      window.localStorage.setItem("storeforge:last_profile_store", slug);
    }

    router.push(`/customer/profile?store=${slug}`);

    setSelectedTenant(tenant);
    setTenantId(tenant.id);
    fetchCustomerData();
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!profile) {
        setErrorMessage("Customer profile not found.");
        return;
      }

      if (!fullName.trim()) {
        setErrorMessage("Full name is required.");
        return;
      }

      const { error } = await supabase
        .from("customer_profiles")
        .update({
          full_name: fullName.trim(),
          email: email || null,
          phone: phone || null,
          date_of_birth: dateOfBirth || null,
          marketing_email_opt_in: marketingEmail,
          marketing_sms_opt_in: marketingSms,
          marketing_whatsapp_opt_in: marketingWhatsapp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .eq("tenant_id", profile.tenant_id)
        .eq("user_id", profile.user_id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Profile updated successfully.");
      fetchCustomerData();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const validateAddress = () => {
    if (!profile || !tenantId || !userId) {
      setErrorMessage("Customer profile not found.");
      return false;
    }

    if (!label.trim()) {
      setErrorMessage("Address label is required.");
      return false;
    }

    if (!addressLine1.trim()) {
      setErrorMessage("Address line 1 is required.");
      return false;
    }

    if (!city.trim()) {
      setErrorMessage("City is required.");
      return false;
    }

    if (!region.trim()) {
      setErrorMessage("Region is required.");
      return false;
    }

    return true;
  };

  const handleSaveAddress = async () => {
    try {
      setSavingAddress(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!validateAddress() || !profile || !tenantId || !userId) return;

      if (isDefault) {
        await supabase
          .from("customer_addresses")
          .update({ is_default: false })
          .eq("tenant_id", tenantId)
          .eq("customer_profile_id", profile.id);
      }

      const payload = {
        tenant_id: tenantId,
        customer_profile_id: profile.id,
        user_id: userId,
        label,
        full_name: addressFullName || fullName || null,
        phone: addressPhone || phone || null,
        address_line1: addressLine1,
        address_line2: addressLine2 || null,
        area: area || null,
        city,
        region,
        country: country || "Ghana",
        postal_code: postalCode || null,
        delivery_instructions: deliveryInstructions || null,
        is_default: isDefault,
        status: "active",
        updated_at: new Date().toISOString(),
      };

      let addressId = editingAddressId;

      if (editingAddressId) {
        const { error } = await supabase
          .from("customer_addresses")
          .update(payload)
          .eq("id", editingAddressId)
          .eq("tenant_id", tenantId)
          .eq("user_id", userId);

        if (error) {
          setErrorMessage(error.message);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("customer_addresses")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        addressId = data.id;
      }

      if (isDefault && addressId) {
        const { error: defaultError } = await supabase.rpc(
          "set_default_customer_address",
          {
            p_address_id: addressId,
            p_user_id: userId,
          }
        );

        if (defaultError) {
          setErrorMessage(defaultError.message);
          return;
        }
      }

      setSuccessMessage(
        editingAddressId
          ? "Address updated successfully."
          : "Address added successfully."
      );

      resetAddressForm();
      fetchCustomerData();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to save address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleEditAddress = (address: CustomerAddress) => {
    setEditingAddressId(address.id);
    setLabel(address.label || "Home");
    setAddressFullName(address.full_name || "");
    setAddressPhone(address.phone || "");
    setAddressLine1(address.address_line1 || "");
    setAddressLine2(address.address_line2 || "");
    setArea(address.area || "");
    setCity(address.city || "");
    setRegion(address.region || "");
    setCountry(address.country || "Ghana");
    setPostalCode(address.postal_code || "");
    setDeliveryInstructions(address.delivery_instructions || "");
    setIsDefault(address.is_default || false);

    setErrorMessage("");
    setSuccessMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSetDefault = async (addressId: string) => {
    if (!userId || !tenantId) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc("set_default_customer_address", {
        p_address_id: addressId,
        p_user_id: userId,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Default address updated.");
      fetchCustomerData();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to set default address.");
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!userId || !tenantId) return;

    const confirmed = confirm("Delete this address?");

    if (!confirmed) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("customer_addresses")
        .delete()
        .eq("id", addressId)
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Address deleted.");
      fetchCustomerData();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to delete address.");
    }
  };

  const loyaltyPointsBalance = Number(loyaltyAccount?.points_balance || 0);

  const loyaltyEstimatedValue =
    loyaltyPointsBalance * Number(loyaltySettings?.currency_per_point || 0);

  const loyaltyMinimumToRedeem = Number(
    loyaltySettings?.minimum_points_to_redeem || 0
  );

  const pointsNeededToRedeem = Math.max(
    0,
    loyaltyMinimumToRedeem - loyaltyPointsBalance
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-500">Loading customer profile...</p>
      </div>
    );
  }

  if (!selectedTenant && errorMessage) {
    return (
      <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-yellow-900">
          Choose a store
        </h1>

        <p className="mt-2 text-yellow-700">{errorMessage}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Browse stores
          </a>

          <a
            href="/my-orders"
            className="rounded-2xl border border-yellow-300 px-5 py-3 text-sm font-semibold text-yellow-900 hover:bg-yellow-100"
          >
            View my orders
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.25),transparent_35%)]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Customer account
            </div>

            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Manage your profile and delivery details.
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              Update your customer profile, saved addresses, marketing
              preferences, and merchant-specific rewards.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/my-orders"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200"
              >
                My Orders
              </a>

              <a
                href={
                  selectedTenant?.slug
                    ? `/customer/loyalty?store=${selectedTenant.slug}`
                    : "/customer/loyalty"
                }
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                My Rewards
              </a>

              <a
                href="/customer/notifications"
                className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Notifications
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
            <CustomerNotificationBell tenantId={tenantId || undefined} />
          </div>
        </div>
      </section>

      {tenantOptions.length > 1 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                Profile store
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-950">
                {selectedTenant?.name || "Select a store"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Customer profiles, saved addresses, and rewards are tracked
                separately for each merchant.
              </p>
            </div>

            <select
              value={selectedTenant?.slug || ""}
              onChange={(event) => handleStoreChange(event.target.value)}
              className="field-input md:max-w-xs"
            >
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.slug}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

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

      {profile && (
        <>
          <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <StatCard label="Orders" value={profile.total_orders || 0} />
            <StatCard
              label="Total Spent"
              value={money(Number(profile.total_spent || 0))}
            />
            <StatCard label="Saved Addresses" value={addresses.length} />
            <StatCard
              label="Last Order"
              value={
                profile.last_order_at
                  ? new Date(profile.last_order_at).toLocaleDateString()
                  : "None"
              }
            />
          </section>

          {loyaltySettings?.is_enabled && (
            <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
              <StatCard
                label={loyaltySettings.reward_name || "Loyalty Points"}
                value={`${loyaltyPointsBalance.toLocaleString()} ${
                  loyaltySettings.reward_currency_label || "points"
                }`}
              />
              <StatCard
                label="Points Value"
                value={money(loyaltyEstimatedValue)}
              />
              <StatCard
                label="Tier"
                value={loyaltyAccount?.tier_name || "Bronze"}
              />
              <StatCard
                label="Redeem Status"
                value={
                  pointsNeededToRedeem === 0
                    ? "Ready"
                    : `${pointsNeededToRedeem.toLocaleString()} more`
                }
              />
            </section>
          )}
        </>
      )}

      {loyaltySettings?.is_enabled && (
        <section className="flex flex-col gap-5 rounded-3xl bg-gradient-to-br from-black to-slate-800 p-6 text-white shadow md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-300">
              {selectedTenant?.name || "Store"} ·{" "}
              {loyaltySettings.reward_name || "Loyalty Rewards"}
            </p>

            <h2 className="mt-2 text-4xl font-bold">
              {loyaltyPointsBalance.toLocaleString()}{" "}
              <span className="text-lg">
                {loyaltySettings.reward_currency_label || "points"}
              </span>
            </h2>

            <p className="mt-3 text-sm text-slate-300">
              Estimated value: {money(loyaltyEstimatedValue)}
            </p>

            {pointsNeededToRedeem > 0 ? (
              <p className="mt-2 text-sm text-yellow-200">
                Earn {pointsNeededToRedeem.toLocaleString()} more point(s) to
                start redeeming rewards.
              </p>
            ) : (
              <p className="mt-2 text-sm text-green-200">
                You have enough points to redeem available rewards.
              </p>
            )}
          </div>

          <a
            href={
              selectedTenant?.slug
                ? `/customer/loyalty?store=${selectedTenant.slug}`
                : "/customer/loyalty"
            }
            className="rounded-xl bg-white px-5 py-3 text-center text-sm font-medium text-black hover:bg-slate-100"
          >
            View My Rewards
          </a>
        </section>
      )}

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold">Profile Details</h2>
          <p className="mt-1 text-sm text-slate-500">
            These details help {selectedTenant?.name || "stores"} fulfill your
            orders correctly.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="field-input"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            className="field-input"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="field-input"
          />

          <input
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            type="date"
            className="field-input"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PreferenceCard
            title="Email updates"
            text="Receive offers and order-related updates by email."
            checked={marketingEmail}
            onChange={setMarketingEmail}
          />

          <PreferenceCard
            title="SMS updates"
            text="Receive important store messages by SMS."
            checked={marketingSms}
            onChange={setMarketingSms}
          />

          <PreferenceCard
            title="WhatsApp updates"
            text="Receive delivery and promotion messages on WhatsApp."
            checked={marketingWhatsapp}
            onChange={setMarketingWhatsapp}
          />
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="rounded-2xl bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {savingProfile ? "Saving..." : "Save Profile"}
        </button>
      </section>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {editingAddressId ? "Edit Address" : "Add Address"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Save delivery locations for {selectedTenant?.name || "this store"}.
            </p>
          </div>

          {editingAddressId && (
            <button
              onClick={resetAddressForm}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <select
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="field-input"
          >
            <option value="Home">Home</option>
            <option value="Work">Work</option>
            <option value="School">School</option>
            <option value="Family">Family</option>
            <option value="Other">Other</option>
          </select>

          <input
            value={addressFullName}
            onChange={(e) => setAddressFullName(e.target.value)}
            placeholder="Recipient name"
            className="field-input"
          />

          <input
            value={addressPhone}
            onChange={(e) => setAddressPhone(e.target.value)}
            placeholder="Recipient phone"
            className="field-input"
          />

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Default address
          </label>
        </div>

        <input
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          placeholder="Address line 1"
          className="field-input"
        />

        <input
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          placeholder="Address line 2 optional"
          className="field-input"
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Area"
            className="field-input"
          />

          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="field-input"
          />

          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region"
            className="field-input"
          />

          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            className="field-input"
          />
        </div>

        <input
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="Postal code optional"
          className="field-input"
        />

        <textarea
          value={deliveryInstructions}
          onChange={(e) => setDeliveryInstructions(e.target.value)}
          placeholder="Delivery instructions optional"
          className="field-input min-h-[100px]"
        />

        <button
          onClick={handleSaveAddress}
          disabled={savingAddress}
          className="rounded-2xl bg-black px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {savingAddress
            ? "Saving..."
            : editingAddressId
            ? "Update Address"
            : "Save Address"}
        </button>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Saved Addresses</h2>
            <p className="mt-1 text-sm text-slate-500">
              Manage delivery addresses for {selectedTenant?.name || "this store"}.
            </p>
          </div>

          <span className="text-sm text-slate-500">
            {addresses.length} address(es)
          </span>
        </div>

        {addresses.length === 0 ? (
          <div className="rounded-2xl border bg-slate-50 p-8 text-center">
            <h3 className="font-semibold">No addresses saved yet</h3>
            <p className="mt-2 text-slate-500">
              Add your first address to speed up checkout.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="flex flex-col gap-4 rounded-2xl border p-5 lg:flex-row lg:items-start lg:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {address.label}
                    </span>

                    {address.is_default && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                        Default
                      </span>
                    )}

                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        address.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {address.status}
                    </span>
                  </div>

                  <h3 className="mt-3 font-semibold">
                    {address.full_name || fullName || "Recipient"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {address.phone || phone || "No phone"}
                  </p>

                  <p className="mt-3 text-sm text-slate-700">
                    {[
                      address.address_line1,
                      address.address_line2,
                      address.area,
                      address.city,
                      address.region,
                      address.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>

                  {address.delivery_instructions && (
                    <p className="mt-2 text-sm text-slate-500">
                      Note: {address.delivery_instructions}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {!address.is_default && (
                    <button
                      onClick={() => handleSetDefault(address.id)}
                      className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100"
                    >
                      Set Default
                    </button>
                  )}

                  <button
                    onClick={() => handleEditAddress(address)}
                    className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDeleteAddress(address.id)}
                    className="rounded-xl bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PreferenceCard({
  title,
  text,
  checked,
  onChange,
}: {
  title: string;
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />

      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-slate-500">{text}</p>
      </div>
    </label>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}