import { createClient } from "@/lib/supabase/client";
import { getOrCreateCart } from "./get-or-create-cart";

export async function addToCart({
  tenantId,
  productId,
}: {
  tenantId: string;
  productId: string;
}) {
  const supabase = createClient();

  // GET CART
  const cart =
    await getOrCreateCart(tenantId);

  // CHECK EXISTING ITEM
  const { data: existingItem } =
    await supabase
      .from("cart_items")
      .select("*")
      .eq("cart_id", cart.id)
      .eq("product_id", productId)
      .single();

  // UPDATE QUANTITY
  if (existingItem) {
    const { error } = await supabase
      .from("cart_items")
      .update({
        quantity:
          existingItem.quantity + 1,
      })
      .eq("id", existingItem.id);

    if (error) throw error;

    return;
  }

  // CREATE ITEM
  const { error } = await supabase
    .from("cart_items")
    .insert({
      cart_id: cart.id,
      product_id: productId,
      quantity: 1,
    });

  if (error) {
    throw error;
  }
}