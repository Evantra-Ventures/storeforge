import DashboardShell from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role === "customer") {
    redirect("/customer/profile");
  }

  if (["admin", "super_admin", "platform_admin"].includes(profile.role || "")) {
    redirect("/admin");
  }

  if (!profile.tenant_id) {
    redirect("/onboarding");
  }

  if (!["store_owner", "owner"].includes(profile.role || "")) {
    redirect("/customer/profile");
  }

  return <DashboardShell>{children}</DashboardShell>;
}