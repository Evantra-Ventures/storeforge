import { createClient } from "@/lib/supabase/client";

export async function getOrCreateCart(
  tenantId: string
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      "User must be authenticated."
    );
  }

  // FIND EXISTING CART
  const { data: existingCart } =
    await supabase
      .from("carts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

  if (existingCart) {
    return existingCart;
  }

  // CREATE CART
  const { data: cart, error } =
    await supabase
      .from("carts")
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        status: "active",
      })
      .select()
      .single();

  if (error) {
    throw error;
  }

  return cart;
}