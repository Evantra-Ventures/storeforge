"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const supabase = createClient();

  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#000000");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  };

  const handleStoreNameChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;

    setStoreName(value);

    // AUTO GENERATE SLUG
    setSlug(generateSlug(value));
  };

  const handleCreateStore = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      // VALIDATION
      if (!storeName || !slug) {
        setErrorMessage("Store name and slug are required.");
        return;
      }

      // GET CURRENT USER
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("User not authenticated.");
        return;
      }

      // CHECK IF SLUG EXISTS
      const { data: existingSlug } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();

      if (existingSlug) {
        setErrorMessage("This store slug is already taken.");
        return;
      }

      // CREATE TENANT
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: storeName,
          slug: slug.toLowerCase(),
          logo_url: logoUrl || null,
          primary_color: primaryColor,
        })
        .select()
        .single();

      if (tenantError) {
        setErrorMessage(tenantError.message);
        return;
      }

      // UPDATE PROFILE
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          tenant_id: tenant.id,
          role: "store_owner",
        })
        .eq("id", user.id);

      if (profileError) {
        setErrorMessage(profileError.message);
        return;
      }

      // REDIRECT TO DASHBOARD
      window.location.href = "/products";

    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-8">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Create Your Store
          </h1>

          <p className="text-slate-500">
            Launch your ecommerce storefront with StoreForge.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-lg bg-red-100 text-red-700 p-4">
            {errorMessage}
          </div>
        )}

        <div className="space-y-6">

          {/* STORE NAME */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Store Name
            </label>

            <input
              type="text"
              placeholder="Tech World"
              value={storeName}
              onChange={handleStoreNameChange}
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* STORE SLUG */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Store Slug
            </label>

            <input
              type="text"
              placeholder="tech-world"
              value={slug}
              onChange={(e) =>
                setSlug(generateSlug(e.target.value))
              }
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-black"
            />

            <p className="text-sm text-slate-500 mt-2">
              Your storefront URL:
            </p>

            <div className="mt-1 bg-slate-100 border rounded-lg px-3 py-2 text-sm font-medium text-slate-700">
              /store/{slug || "your-store"}
            </div>
          </div>

          {/* LOGO URL */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Logo URL (Optional)
            </label>

            <input
              type="text"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* PRIMARY COLOR */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Brand Color
            </label>

            <div className="flex items-center gap-4">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) =>
                  setPrimaryColor(e.target.value)
                }
                className="h-14 w-20 border rounded-lg cursor-pointer"
              />

              <div className="text-sm text-slate-600 font-medium">
                {primaryColor}
              </div>
            </div>
          </div>

          {/* BUTTON */}
          <button
            onClick={handleCreateStore}
            disabled={loading}
            className="w-full bg-black text-white rounded-xl p-4 font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading
              ? "Creating Store..."
              : "Create Store"}
          </button>

        </div>
      </div>
    </div>
  );
}