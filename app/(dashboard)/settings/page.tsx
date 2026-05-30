"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FileUploader from "@/components/ui/FileUploader";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  currency: string | null;
  contact_email: string | null;
  support_phone: string | null;
  business_address: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  whatsapp_url: string | null;
  pickup_instructions: string | null;
  payment_instructions: string | null;
  reviews_enabled: boolean | null;
  review_moderation_enabled: boolean | null;
};

export default function SettingsPage() {
  const supabase = createClient();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [currency, setCurrency] = useState("GHS");
  const [contactEmail, setContactEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [reviewsEnabled, setReviewsEnabled] = useState(true);
  const [reviewModerationEnabled, setReviewModerationEnabled] = useState(false);

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

  const fetchSettings = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return;

      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", profile.tenant_id)
        .single();

      if (error || !data) {
        console.error(error);
        return;
      }

      setTenant(data);

      setName(data.name || "");
      setSlug(data.slug || "");
      setDescription(data.description || "");
      setLogoUrl(data.logo_url || "");
      setBannerUrl(data.banner_url || "");
      setCurrency(data.currency || "GHS");
      setContactEmail(data.contact_email || "");
      setSupportPhone(data.support_phone || "");
      setBusinessAddress(data.business_address || "");
      setFacebookUrl(data.facebook_url || "");
      setInstagramUrl(data.instagram_url || "");
      setWhatsappUrl(data.whatsapp_url || "");
      setPickupInstructions(data.pickup_instructions || "");
      setPaymentInstructions(data.payment_instructions || "");
      setReviewsEnabled(data.reviews_enabled ?? true);
      setReviewModerationEnabled(data.review_moderation_enabled ?? false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenant) return;

    if (!name.trim()) {
      alert("Store name is required.");
      return;
    }

    if (!slug.trim()) {
      alert("Store slug is required.");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("tenants")
        .update({
          name,
          slug: generateSlug(slug),
          description: description || null,
          logo_url: logoUrl || null,
          banner_url: bannerUrl || null,
          currency,
          contact_email: contactEmail || null,
          support_phone: supportPhone || null,
          business_address: businessAddress || null,
          facebook_url: facebookUrl || null,
          instagram_url: instagramUrl || null,
          whatsapp_url: whatsappUrl || null,
          pickup_instructions: pickupInstructions || null,
          payment_instructions: paymentInstructions || null,
          reviews_enabled: reviewsEnabled,
          review_moderation_enabled: reviewModerationEnabled,
        })
        .eq("id", tenant.id);

      if (error) {
        alert(error.message);
        return;
      }

      alert("Settings updated successfully.");
      fetchSettings();
    } catch (error) {
      console.error(error);
      alert("Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) {
    return <p className="text-slate-500">Loading settings...</p>;
  }

  if (!tenant) {
    return (
      <div className="bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold">Store not found</h1>
        <p className="text-slate-500 mt-2">
          No tenant profile was found for this account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-slate-500 mt-2">
          Manage your store profile, branding, reviews, contact details, and checkout instructions.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold">Store Profile</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(generateSlug(e.target.value));
            }}
            placeholder="Store name"
            className="border rounded-xl p-3"
          />

          <input
            value={slug}
            onChange={(e) => setSlug(generateSlug(e.target.value))}
            placeholder="store-slug"
            className="border rounded-xl p-3"
          />
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short store description"
          className="w-full border rounded-xl p-3 min-h-[120px]"
        />

        <div className="bg-slate-100 rounded-xl p-4 text-sm">
          Public Store URL:{" "}
          <span className="font-medium">/store/{generateSlug(slug)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold">Branding</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <FileUploader
              bucket="store-assets"
              tenantId={tenant.id}
              folder="logo"
              label="Upload Store Logo"
              onUploadComplete={(url) => setLogoUrl(url)}
            />

            {logoUrl && (
              <img
                src={logoUrl}
                alt="Store logo"
                className="w-24 h-24 object-cover rounded-xl border mt-4"
              />
            )}
          </div>

          <div>
            <FileUploader
              bucket="store-assets"
              tenantId={tenant.id}
              folder="banner"
              label="Upload Store Banner"
              onUploadComplete={(url) => setBannerUrl(url)}
            />

            {bannerUrl && (
              <img
                src={bannerUrl}
                alt="Store banner"
                className="w-full h-32 object-cover rounded-xl border mt-4"
              />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold">Reviews</h2>

        <label className="border rounded-2xl p-4 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={reviewsEnabled}
            onChange={(e) => setReviewsEnabled(e.target.checked)}
            className="mt-1"
          />

          <div>
            <p className="font-medium">Enable product reviews</p>
            <p className="text-sm text-slate-500 mt-1">
              Customers can submit reviews on product pages.
            </p>
          </div>
        </label>

        <label className="border rounded-2xl p-4 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={reviewModerationEnabled}
            onChange={(e) => setReviewModerationEnabled(e.target.checked)}
            disabled={!reviewsEnabled}
            className="mt-1"
          />

          <div>
            <p className="font-medium">Require review moderation</p>
            <p className="text-sm text-slate-500 mt-1">
              New reviews will be marked as pending until you publish them.
            </p>
          </div>
        </label>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold">Contact & Business Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="GHS">GHS - Ghana Cedi</option>
            <option value="USD">USD - US Dollar</option>
            <option value="NGN">NGN - Nigerian Naira</option>
          </select>

          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Contact email"
            className="border rounded-xl p-3"
          />

          <input
            value={supportPhone}
            onChange={(e) => setSupportPhone(e.target.value)}
            placeholder="Support phone"
            className="border rounded-xl p-3"
          />

          <input
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            placeholder="Business address"
            className="border rounded-xl p-3"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold">Social Links</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            value={facebookUrl}
            onChange={(e) => setFacebookUrl(e.target.value)}
            placeholder="Facebook URL"
            className="border rounded-xl p-3"
          />

          <input
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="Instagram URL"
            className="border rounded-xl p-3"
          />

          <input
            value={whatsappUrl}
            onChange={(e) => setWhatsappUrl(e.target.value)}
            placeholder="WhatsApp link"
            className="border rounded-xl p-3"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold">Checkout Instructions</h2>

        <textarea
          value={pickupInstructions}
          onChange={(e) => setPickupInstructions(e.target.value)}
          placeholder="Pickup instructions for customers"
          className="w-full border rounded-xl p-3 min-h-[100px]"
        />

        <textarea
          value={paymentInstructions}
          onChange={(e) => setPaymentInstructions(e.target.value)}
          placeholder="Payment or order instructions"
          className="w-full border rounded-xl p-3 min-h-[100px]"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-black text-white px-8 py-4 rounded-2xl font-medium disabled:opacity-50"
      >
        {saving ? "Saving Settings..." : "Save Settings"}
      </button>
    </div>
  );
}