"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignup = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (!data.user) {
        setErrorMessage("User creation failed.");
        return;
      }

      window.location.href = "/onboarding";
    } catch (error) {
      setErrorMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      
      {/* LEFT PANEL */}
      <div className="hidden md:flex flex-col justify-center bg-slate-950 text-white p-16">
        <h1 className="text-5xl font-bold mb-6">
          Build Your Storefront Empire
        </h1>

        <p className="text-lg text-slate-300 leading-relaxed">
          Launch modern ecommerce storefronts with StoreForge.
          Multi-tenant SaaS infrastructure built for scale.
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">

          <h2 className="text-3xl font-bold mb-2">
            Create Account
          </h2>

          <p className="text-slate-500 mb-8">
            Start building your online store today.
          </p>

          {errorMessage && (
            <div className="mb-4 bg-red-100 text-red-700 p-3 rounded-lg">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">

            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border rounded-lg p-3"
            />

            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg p-3"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg p-3"
            />

            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full bg-black text-white rounded-lg p-3 font-medium hover:opacity-90 transition"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>

          </div>

          <p className="text-sm text-slate-500 mt-6">
            Already have an account?{" "}
            <a
              href="/login"
              className="text-black font-medium"
            >
              Login
            </a>
          </p>

        </div>
      </div>
    </div>
  );
}