"use client";

import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import { useEffect, useState } from "react";
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

export default function CustomerProfilePage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loyaltyAccount, setLoyaltyAccount] = useState<LoyaltyAccount | null>(
    null
  );
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

  const money = (value: number) => `GHS ${Number(value || 0).toFixed(2)}`;

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

  const fetchCustomerData = async () => {
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

      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .limit(1)
        .maybeSingle();

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      const resolvedTenantId = profileRow?.tenant_id || tenant?.id;

      if (!resolvedTenantId) {
        setErrorMessage("Tenant not found.");
        return;
      }

      setTenantId(resolvedTenantId);


      const { data: ensuredProfileId, error: ensureError } = await supabase.rpc(
        "ensure_customer_profile",
        {
          p_tenant_id: resolvedTenantId,
          p_user_id: user.id,
          p_full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null,
          p_email: user.email || null,
          p_phone: user.phone || null,
        }
      );

      if (ensureError) {
        setErrorMessage(ensureError.message);
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
        .eq("tenant_id", resolvedTenantId)
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (addressError) {
        setErrorMessage(addressError.message);
        return;
      }

      setAddresses(addressData || []);

      await supabase.rpc("ensure_loyalty_settings", {
        p_tenant_id: resolvedTenantId,
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
        .eq("tenant_id", resolvedTenantId)
        .maybeSingle();

      setLoyaltySettings(settingsData || null);

      if (profileData?.id) {
        const { data: loyaltyAccountId } = await supabase.rpc(
          "ensure_customer_loyalty_account",
          {
            p_tenant_id: resolvedTenantId,
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
  }, []);

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
          full_name: fullName,
          email: email || null,
          phone: phone || null,
          date_of_birth: dateOfBirth || null,
          marketing_email_opt_in: marketingEmail,
          marketing_sms_opt_in: marketingSms,
          marketing_whatsapp_opt_in: marketingWhatsapp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
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
    if (!userId) return;

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
    if (!userId) return;

    const confirmed = confirm("Delete this address?");
    if (!confirmed) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("customer_addresses")
        .delete()
        .eq("id", addressId)
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
    return <p className="text-slate-500">Loading customer profile...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Customer Profile</h1>
          <p className="text-slate-500 mt-2">
            Manage your personal details, marketing preferences, saved delivery
            addresses, and rewards.
          </p>
        </div>

        <CustomerNotificationBell />
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

      {profile && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
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
          </div>

          {loyaltySettings?.is_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
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
              <StatCard label="Tier" value={loyaltyAccount?.tier_name || "Bronze"} />
              <StatCard
                label="Redeem Status"
                value={
                  pointsNeededToRedeem === 0
                    ? "Ready"
                    : `${pointsNeededToRedeem.toLocaleString()} more`
                }
              />
            </div>
          )}
        </>
      )}

      {loyaltySettings?.is_enabled && (
        <div className="bg-gradient-to-br from-black to-slate-800 text-white rounded-3xl shadow p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="text-sm text-slate-300">
              {loyaltySettings.reward_name || "Loyalty Rewards"}
            </p>

            <h2 className="text-4xl font-bold mt-2">
              {loyaltyPointsBalance.toLocaleString()}{" "}
              <span className="text-lg">
                {loyaltySettings.reward_currency_label || "points"}
              </span>
            </h2>

            <p className="text-sm text-slate-300 mt-3">
              Estimated value: {money(loyaltyEstimatedValue)}
            </p>

            {pointsNeededToRedeem > 0 ? (
              <p className="text-sm text-yellow-200 mt-2">
                Earn {pointsNeededToRedeem.toLocaleString()} more point(s) to
                start redeeming rewards.
              </p>
            ) : (
              <p className="text-sm text-green-200 mt-2">
                You have enough points to redeem available rewards.
              </p>
            )}
          </div>

          <a
            href="/customer/loyalty"
            className="bg-white text-black px-5 py-3 rounded-xl text-sm font-medium text-center hover:bg-slate-100"
          >
            View My Rewards
          </a>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Profile Details</h2>
          <p className="text-sm text-slate-500 mt-1">
            These details help stores fulfill your orders correctly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="border rounded-xl p-3"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            className="border rounded-xl p-3"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            className="border rounded-xl p-3"
          />

          <input
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            type="date"
            className="border rounded-xl p-3"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="border rounded-xl p-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={marketingEmail}
              onChange={(e) => setMarketingEmail(e.target.checked)}
              className="mt-1"
            />
            <div>
              <p className="font-medium">Email updates</p>
              <p className="text-xs text-slate-500">
                Receive offers and order-related updates by email.
              </p>
            </div>
          </label>

          <label className="border rounded-xl p-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={marketingSms}
              onChange={(e) => setMarketingSms(e.target.checked)}
              className="mt-1"
            />
            <div>
              <p className="font-medium">SMS updates</p>
              <p className="text-xs text-slate-500">
                Receive important store messages by SMS.
              </p>
            </div>
          </label>

          <label className="border rounded-xl p-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={marketingWhatsapp}
              onChange={(e) => setMarketingWhatsapp(e.target.checked)}
              className="mt-1"
            />
            <div>
              <p className="font-medium">WhatsApp updates</p>
              <p className="text-xs text-slate-500">
                Receive delivery and promotion messages on WhatsApp.
              </p>
            </div>
          </label>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
        >
          {savingProfile ? "Saving..." : "Save Profile"}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {editingAddressId ? "Edit Address" : "Add Address"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Save delivery locations to make checkout faster.
            </p>
          </div>

          {editingAddressId && (
            <button
              onClick={resetAddressForm}
              className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="border rounded-xl p-3"
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
            className="border rounded-xl p-3"
          />

          <input
            value={addressPhone}
            onChange={(e) => setAddressPhone(e.target.value)}
            placeholder="Recipient phone"
            className="border rounded-xl p-3"
          />

          <label className="border rounded-xl p-3 flex items-center gap-2">
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
          className="border rounded-xl p-3 w-full"
        />

        <input
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          placeholder="Address line 2 optional"
          className="border rounded-xl p-3 w-full"
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Area"
            className="border rounded-xl p-3"
          />

          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="border rounded-xl p-3"
          />

          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region"
            className="border rounded-xl p-3"
          />

          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            className="border rounded-xl p-3"
          />
        </div>

        <input
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          placeholder="Postal code optional"
          className="border rounded-xl p-3 w-full"
        />

        <textarea
          value={deliveryInstructions}
          onChange={(e) => setDeliveryInstructions(e.target.value)}
          placeholder="Delivery instructions optional"
          className="border rounded-xl p-3 min-h-[100px] w-full"
        />

        <button
          onClick={handleSaveAddress}
          disabled={savingAddress}
          className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
        >
          {savingAddress
            ? "Saving..."
            : editingAddressId
            ? "Update Address"
            : "Save Address"}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Saved Addresses</h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage your delivery addresses.
            </p>
          </div>

          <span className="text-sm text-slate-500">
            {addresses.length} address(es)
          </span>
        </div>

        {addresses.length === 0 ? (
          <div className="bg-slate-50 border rounded-2xl p-8 text-center">
            <h3 className="font-semibold">No addresses saved yet</h3>
            <p className="text-slate-500 mt-2">
              Add your first address to speed up checkout.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">
                      {address.label}
                    </span>

                    {address.is_default && (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                        Default
                      </span>
                    )}

                    <span
                      className={`px-3 py-1 rounded-full text-xs ${
                        address.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {address.status}
                    </span>
                  </div>

                  <h3 className="font-semibold mt-3">
                    {address.full_name || fullName || "Recipient"}
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    {address.phone || phone || "No phone"}
                  </p>

                  <p className="text-sm text-slate-700 mt-3">
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
                    <p className="text-sm text-slate-500 mt-2">
                      Note: {address.delivery_instructions}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {!address.is_default && (
                    <button
                      onClick={() => handleSetDefault(address.id)}
                      className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
                    >
                      Set Default
                    </button>
                  )}

                  <button
                    onClick={() => handleEditAddress(address)}
                    className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDeleteAddress(address.id)}
                    className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerNav({
  unreadNotificationsCount,
}: {
  unreadNotificationsCount: number;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <a
        href="/customer/loyalty"
        className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
      >
        My Rewards
      </a>

      <a
        href="/my-orders"
        className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
      >
        My Orders
      </a>

      <CustomerNotificationBell />

    </div>
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
    <div className="bg-white rounded-2xl shadow p-6">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="text-3xl font-bold mt-2">{value}</h2>
    </div>
  );
}