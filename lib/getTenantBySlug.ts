import { createClient } from "@supabase/supabase-js";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  description?: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type { Tenant };

export async function getTenantBySlug(slug: string): Promise<Tenant> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
