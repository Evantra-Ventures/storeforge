"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      if (!email.trim()) {
        setErrorMessage("Email is required.");
        return;
      }

      if (!password.trim()) {
        setErrorMessage("Password is required.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      window.location.href = "/products";
    } catch (error) {
      console.error(error);
      setErrorMessage("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
              Welcome back
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              Manage your store, orders, customers, and growth.
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              Log in to your StoreForge dashboard to manage products, track
              orders, reward customers, send notifications, and keep your online
              store running smoothly.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
              <div>
                <p className="text-3xl font-bold">24/7</p>
                <p className="mt-1 text-sm text-slate-400">store access</p>
              </div>

              <div>
                <p className="text-3xl font-bold">Smart</p>
                <p className="mt-1 text-sm text-slate-400">commerce tools</p>
              </div>

              <div>
                <p className="text-3xl font-bold">Secure</p>
                <p className="mt-1 text-sm text-slate-400">merchant login</p>
              </div>
            </div>
          </div>

          <div className="relative text-sm text-slate-400">
            Built for modern African and global ecommerce brands.
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
                  Merchant Login
                </p>

                <h1 className="mt-3 text-3xl font-bold tracking-tight">
                  Welcome back
                </h1>

                <p className="mt-3 text-slate-500">
                  Sign in to continue managing your StoreForge dashboard.
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
                    Email Address
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
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
                Do not have an account?{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-slate-950 hover:underline"
                >
                  Create account
                </Link>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              By logging in, you agree to manage your store securely and protect
              customer information.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}