import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedAdminRoles = ["platform_admin", "admin", "super_admin"];
const allowedStatuses = ["draft", "active", "paused", "suspended"];

export async function PATCH(
  request: Request,
  { params }: { params: { tenantId: string } }
) {
  try {
    const supabase = createClient();
    const tenantId = params.tenantId;

    const { status, reason } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID is required." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid store status." },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !allowedAdminRoles.includes(profile?.role || "")) {
      return NextResponse.json(
        { error: "Only platform admins can update store status." },
        { status: 403 }
      );
    }

    const { data: currentTenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id,name,slug,status,status_reason")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError || !currentTenant) {
      return NextResponse.json({ error: "Store not found." }, { status: 404 });
    }

    const { data: updatedTenant, error: updateError } = await supabase
      .from("tenants")
      .update({
        status,
        status_reason: reason || null,
        status_updated_at: new Date().toISOString(),
        status_updated_by: user.id,
        published_at:
          status === "active" && currentTenant.status !== "active"
            ? new Date().toISOString()
            : undefined,
      })
      .eq("id", tenantId)
      .select("id,name,slug,status,status_reason,status_updated_at")
      .single();

    if (updateError || !updatedTenant) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to update store status." },
        { status: 400 }
      );
    }

    await supabase.from("platform_audit_logs").insert({
      actor_id: user.id,
      tenant_id: tenantId,
      action: "store_status_updated",
      entity_type: "tenant",
      entity_id: tenantId,
      old_values: {
        status: currentTenant.status,
        status_reason: currentTenant.status_reason,
      },
      new_values: {
        status: updatedTenant.status,
        status_reason: updatedTenant.status_reason,
      },
      metadata: {
        store_name: currentTenant.name,
        store_slug: currentTenant.slug,
      },
    });

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to update store status." },
      { status: 500 }
    );
  }
}