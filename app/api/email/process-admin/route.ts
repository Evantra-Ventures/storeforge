import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: "Tenant profile not found." },
        { status: 404 }
      );
    }

    const allowedRoles = ["store_owner", "admin", "super_admin"];

    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: "You do not have permission to process emails." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit || 10), 50);

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL
        ? process.env.VERCEL_URL.startsWith("http")
          ? process.env.VERCEL_URL
          : `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const response = await fetch(`${baseUrl}/api/email/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-email-worker-secret": process.env.EMAIL_WORKER_SECRET || "",
      },
      body: JSON.stringify({ limit }),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Email processor failed." },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Admin email processing failed." },
      { status: 500 }
    );
  }
}