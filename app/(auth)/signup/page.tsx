"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSafeRedirect(value: string | null) {
  if (!value) return "/customer/profile";
  if (!value.startsWith("/")) return "/customer/profile";
  if (value.startsWith("//")) return "/customer/profile";
  return value;
}

function SignupContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const redirectTo = getSafeRedirect(searchParams.get("redirect"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSignup = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!fullName.trim()) {
        setErrorMessage("Full name is required.");
        return;
      }

      if (!email.trim()) {
        setErrorMessage("Email is required.");
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

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: "customer",
          },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}${redirectTo}`
              : undefined,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.user) {
        setErrorMessage("Account creation failed.");
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          full_name: fullName.trim(),
          role: "customer",
        },
        {
          onConflict: "id",
        }
      );

      if (profileError) {
        console.warn("Profile upsert warning:", profileError.message);
      }

      if (!data.session) {
        setSuccessMessage(
          "Account created. Please check your email to confirm your account, then sign in."
        );
        return;
      }

      window.location.href = redirectTo;
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loginHref =
    redirectTo && redirectTo !== "/customer/profile"
      ? `/login?redirect=${encodeURIComponent(redirectTo)}`
      : "/login";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-slate-950 px-12 py-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.22),transparent_35%)]" />

          <div className="relative">
            <Link href="/" className="text-2xl font-bold tracking-tight">
              StoreForge
            </Link>
          </div>

          <div className="relative max-w-xl">
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Customer account
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              Shop across stores with one customer account.
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              Create an account to checkout faster, track orders, save wishlist
              items, earn rewards, and receive important store notifications.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
              <div>
                <p className="text-3xl font-bold">Fast</p>
                <p className="mt-1 text-sm text-slate-400">checkout</p>
              </div>

              <div>
                <p className="text-3xl font-bold">Track</p>
                <p className="mt-1 text-sm text-slate-400">orders</p>
              </div>

              <div>
                <p className="text-3xl font-bold">Earn</p>
                <p className="mt-1 text-sm text-slate-400">rewards</p>
              </div>
            </div>
          </div>

          <div className="relative text-sm text-slate-400">
            Want to sell on StoreForge? Use merchant onboarding instead.
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-950">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <Link href="/" className="text-2xl font-bold tracking-tight">
                StoreForge
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                  Customer signup
                </p>

                <h1 className="mt-3 text-3xl font-bold tracking-tight">
                  Create your account
                </h1>

                <p className="mt-3 text-slate-500">
                  Sign up to buy products, save your wishlist, track orders, and
                  manage rewards.
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleSignup();
                      }
                    }}
                  />
                </div>

                <button
                  onClick={handleSignup}
                  disabled={loading}
                  className="w-full rounded-2xl bg-slate-950 px-6 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>
              </div>

              <div className="mt-8 border-t border-slate-100 pt-6 text-sm text-slate-500">
                Already have an account?{" "}
                <Link
                  href={loginHref}
                  className="font-semibold text-slate-950 hover:underline"
                >
                  Log in
                </Link>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              Customer accounts are used for orders, wishlist, notifications,
              and rewards across StoreForge stores.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}