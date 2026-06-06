"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeStoreName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export default function StartSellingPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleMerchantSignup = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const safeFullName = fullName.trim();
      const safeStoreName = normalizeStoreName(storeName);
      const safeEmail = normalizeEmail(email);

      if (!safeFullName) {
        setErrorMessage("Full name is required.");
        return;
      }

      if (!safeStoreName) {
        setErrorMessage("Store name is required.");
        return;
      }

      if (!safeEmail) {
        setErrorMessage("Email is required.");
        return;
      }

      if (!safeEmail.includes("@")) {
        setErrorMessage("Enter a valid email address.");
        return;
      }

      if (!password.trim()) {
        setErrorMessage("Password is required.");
        return;
      }

      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/onboarding`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: safeEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: safeFullName,
            name: safeFullName,

            store_name: safeStoreName,

            role: "store_owner",
            intended_role: "store_owner",
            account_type: "merchant",
            signup_type: "merchant",
            is_merchant: true,
            onboarding_required: true,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.user) {
        setErrorMessage("Merchant account creation failed.");
        return;
      }

      /*
        This is a best-effort profile update.
        The secure source of truth for onboarding is auth.users.raw_user_meta_data,
        which the create_merchant_store RPC reads.
        If RLS blocks this update, onboarding can still work through the RPC.
      */
      if (data.session) {
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            full_name: safeFullName,
            role: "store_owner",
          },
          {
            onConflict: "id",
          }
        );

        if (profileError) {
          console.warn("Profile upsert warning:", profileError.message);
        }

        window.location.href = "/onboarding";
        return;
      }

      setSuccessMessage(
        "Merchant account created. Please check your email to confirm your account, then sign in to continue onboarding."
      );
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-slate-950 px-12 py-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.22),transparent_35%)]" />
          <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="relative">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/images/logo/dark-logo.png"
                alt="StoreForge"
                width={180}
                height={48}
                priority
                className="h-9 w-auto"
              />
            </Link>
          </div>

          <div className="relative max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              <Image
                src="/images/logo/icon64x64.png"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5"
              />
              <span>Merchant signup</span>
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              Start selling online with your own branded storefront.
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              Create your store, upload products, customize your storefront,
              manage orders, send customer updates, and grow your ecommerce
              business from one dashboard.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-bold">Launch</p>
                <p className="mt-1 text-sm text-slate-400">your shop</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-bold">Sell</p>
                <p className="mt-1 text-sm text-slate-400">products</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-bold">Grow</p>
                <p className="mt-1 text-sm text-slate-400">customers</p>
              </div>
            </div>
          </div>

          <div className="relative text-sm text-slate-400">
            Shopping as a customer? Create a customer account instead.
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <Link href="/" className="inline-flex items-center">
                <Image
                  src="/images/logo/primary-logo.png"
                  alt="StoreForge"
                  width={180}
                  height={48}
                  priority
                  className="h-9 w-auto"
                />
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div>
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950">
                  <Image
                    src="/images/logo/icon64x64.png"
                    alt=""
                    width={34}
                    height={34}
                    className="h-9 w-9"
                  />
                </div>

                <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                  Start selling
                </p>

                <h1 className="mt-3 text-3xl font-bold tracking-tight">
                  Create your merchant account
                </h1>

                <p className="mt-3 text-slate-500">
                  Sign up as a merchant to create your shop, customize your
                  storefront, and start managing products and orders.
                </p>
              </div>

              {errorMessage && (
                <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="mt-6 rounded-2xl bg-green-50 p-4 text-sm text-green-700">
                  {successMessage}
                </div>
              )}

              <div className="mt-8 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Full name
                  </label>

                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none transition focus:border-slate-950"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Store name
                  </label>

                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none transition focus:border-slate-950"
                    placeholder="Example: Tech World"
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Email address
                  </label>

                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none transition focus:border-slate-950"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Password
                  </label>

                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none transition focus:border-slate-950"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Confirm password
                  </label>

                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none transition focus:border-slate-950"
                    type="password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={loading}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !loading) {
                        handleMerchantSignup();
                      }
                    }}
                  />
                </div>

                <button
                  onClick={handleMerchantSignup}
                  disabled={loading}
                  className="w-full rounded-2xl bg-slate-950 px-6 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creating merchant account..." : "Start selling"}
                </button>
              </div>

              <div className="mt-8 border-t border-slate-100 pt-6 text-sm text-slate-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-slate-950 hover:underline"
                >
                  Log in
                </Link>
              </div>

              <div className="mt-4 text-sm text-slate-500">
                Want to shop instead?{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-slate-950 hover:underline"
                >
                  Create customer account
                </Link>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Merchant accounts are used for storefront setup, product
              management, orders, analytics, marketing, and payouts.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}