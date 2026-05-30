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

    const { emailQueueId } = await request.json();

    if (!emailQueueId) {
      return NextResponse.json(
        { error: "Email queue ID is required." },
        { status: 400 }
      );
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

    const allowedRoles = ["owner", "store_owner", "admin", "super_admin"];

    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: "You do not have permission to retry emails." },
        { status: 403 }
      );
    }

    const { data: queueItem, error: queueError } = await supabase
      .from("notification_email_queue")
      .select("id,tenant_id,status")
      .eq("id", emailQueueId)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (queueError || !queueItem) {
      return NextResponse.json(
        { error: "Email queue item not found." },
        { status: 404 }
      );
    }

    if (queueItem.status !== "failed") {
      return NextResponse.json(
        { error: "Only failed emails can be retried." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("notification_email_queue")
      .update({
        status: "pending",
        error_message: null,
        failed_at: null,
        scheduled_at: new Date().toISOString(),
      })
      .eq("id", emailQueueId)
      .eq("tenant_id", profile.tenant_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Email queued for retry.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to retry email." },
      { status: 500 }
    );
  }
}