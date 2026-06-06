"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSafeRedirect(value: string | null) {
  if (!value) return "";
  if (!value.startsWith("/")) return "";
  if (value.startsWith("//")) return "";
  return value;
}

function LoginContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const redirectTo = getSafeRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const safeEmail = email.trim().toLowerCase();

      if (!safeEmail) {
        setErrorMessage("Email is required.");
        return;
      }

      if (!password.trim()) {
        setErrorMessage("Password is required.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: safeEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const userId = data.user?.id;

      if (!userId) {
        setErrorMessage("Login failed. Please try again.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, tenant_id")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        setErrorMessage(profileError.message);
        return;
      }

      const role = profile?.role || "customer";

      const isPlatformAdmin = ["admin", "super_admin", "platform_admin"].includes(
        role
      );

      const isMerchant = ["owner", "store_owner"].includes(role);

      if (isPlatformAdmin) {
        window.location.href =
          redirectTo && redirectTo.startsWith("/admin") ? redirectTo : "/admin";
        return;
      }

      if (redirectTo) {
        window.location.href = redirectTo;
        return;
      }

      if (isMerchant) {
        window.location.href = profile?.tenant_id ? "/dashboard" : "/onboarding";
        return;
      }

      window.location.href = "/customer/profile";
    } catch (error) {
      console.error(error);
      setErrorMessage("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const signupHref = redirectTo
    ? `/signup?redirect=${encodeURIComponent(redirectTo)}`
    : "/signup";

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
              <span>Welcome back</span>
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              Sign in to shop, track orders, manage your store, or control the platform.
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              Customers can manage orders, wishlist, notifications, and rewards.
              Merchants can access products, orders, marketing, analytics, and
              storefront settings. Platform admins can manage stores, payouts,
              orders, and audit logs.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-bold">Track</p>
                <p className="mt-1 text-sm text-slate-400">orders</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-bold">Sell</p>
                <p className="mt-1 text-sm text-slate-400">online</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-bold">Admin</p>
                <p className="mt-1 text-sm text-slate-400">platform</p>
              </div>
            </div>
          </div>

          <div className="relative text-sm text-slate-400">
            One secure account for customer shopping, merchant management, and
            platform administration.
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
                  Account login
                </p>

                <h1 className="mt-3 text-3xl font-bold tracking-tight">
                  Welcome back
                </h1>

                <p className="mt-3 text-slate-500">
                  Sign in to continue shopping, track orders, manage your
                  StoreForge dashboard, or access platform admin tools.
                </p>
              </div>

              {errorMessage && (
                <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="mt-8 space-y-4">
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
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <label className="block text-sm font-medium">
                      Password
                    </label>

                    <a
                      href="#"
                      className="text-sm font-medium text-sky-600 hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>

                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-4 outline-none transition focus:border-slate-950"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !loading) {
                        handleLogin();
                      }
                    }}
                  />
                </div>

                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full rounded-2xl bg-slate-950 px-6 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Logging in..." : "Log in"}
                </button>
              </div>

              <div className="mt-8 border-t border-slate-100 pt-6 text-sm text-slate-500">
                Do not have a customer account?{" "}
                <Link
                  href={signupHref}
                  className="font-semibold text-slate-950 hover:underline"
                >
                  Create customer account
                </Link>
              </div>

              <div className="mt-4 text-sm text-slate-500">
                Want to sell online?{" "}
                <Link
                  href="/start-selling"
                  className="font-semibold text-slate-950 hover:underline"
                >
                  Start selling
                </Link>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Keep your login secure. Store owners and admins should protect
              customer, order, and payout information carefully.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}