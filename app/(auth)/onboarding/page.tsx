"use client";

import Image from "next/image";
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
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  const handleStoreNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    setStoreName(value);
    setSlug(generateSlug(value));
  };

  const handleCreateStore = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const safeStoreName = storeName.trim();
      const safeSlug = generateSlug(slug);

      if (!safeStoreName) {
        setErrorMessage("Store name is required.");
        return;
      }

      if (!safeSlug) {
        setErrorMessage("Store slug is required.");
        return;
      }

      if (safeSlug.length < 3) {
        setErrorMessage("Store slug must be at least 3 characters.");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMessage("User not authenticated. Please log in again.");
        return;
      }

      const { data: tenantId, error: storeError } = await supabase.rpc(
        "create_merchant_store",
        {
          p_name: safeStoreName,
          p_slug: safeSlug,
          p_logo_url: logoUrl.trim() || null,
          p_primary_color: primaryColor || "#000000",
        }
      );

      if (storeError) {
        setErrorMessage(storeError.message);
        return;
      }

      if (!tenantId) {
        setErrorMessage("Store creation failed. Please try again.");
        return;
      }

      window.location.href = "/dashboard";
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong while creating your store.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
          <div className="mb-8">
            <div className="mb-6">
              <Image
                src="/images/logo/primary-logo.png"
                alt="StoreForge"
                width={180}
                height={48}
                priority
                className="h-9 w-auto"
              />
            </div>

            <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
              Merchant onboarding
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
              Create Your Store
            </h1>

            <p className="mt-3 text-slate-500">
              Launch your ecommerce storefront with StoreForge. Your store will
              start as draft until it is ready to publish.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-6 rounded-2xl bg-red-50 p-4 text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Store Name
              </label>

              <input
                type="text"
                placeholder="Tech World"
                value={storeName}
                onChange={handleStoreNameChange}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-slate-950"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Store Slug
              </label>

              <input
                type="text"
                placeholder="tech-world"
                value={slug}
                onChange={(event) => setSlug(generateSlug(event.target.value))}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-slate-950"
              />

              <p className="mt-3 text-sm text-slate-500">
                Your storefront URL:
              </p>

              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
                /store/{slug || "your-store"}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Logo URL optional
              </label>

              <input
                type="text"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-slate-950"
              />

              <p className="mt-2 text-xs text-slate-500">
                You can skip this now and upload or add branding later from
                dashboard settings.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Brand Color
              </label>

              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="h-14 w-20 cursor-pointer rounded-xl border"
                />

                <div className="text-sm font-medium text-slate-600">
                  {primaryColor}
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateStore}
              disabled={loading}
              className="w-full rounded-2xl bg-slate-950 p-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating Store..." : "Create Store"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}