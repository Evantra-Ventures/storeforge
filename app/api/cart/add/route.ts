import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    let tenantId: string | null = null;
    let productId: string | null = null;
    let variantId: string | null = null;
    let quantity = 1;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();

      tenantId = body.tenantId;
      productId = body.productId;
      variantId = body.variantId || null;
      quantity = Number(body.quantity || 1);
    } else {
      const formData = await request.formData();

      tenantId = String(formData.get("tenantId") || "");
      productId = String(formData.get("productId") || "");
      variantId = String(formData.get("variantId") || "") || null;
      quantity = Number(formData.get("quantity") || 1);
    }

    if (!tenantId || !productId) {
      return NextResponse.json(
        { error: "Tenant ID and Product ID are required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      quantity = 1;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, tenant_id, inventory, status")
      .eq("id", productId)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .single();

    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    let availableInventory = Number(product.inventory || 0);

    if (variantId) {
      const { data: variant } = await supabase
        .from("product_variants")
        .select("id, tenant_id, product_id, inventory, status")
        .eq("id", variantId)
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .eq("status", "active")
        .single();

      if (!variant) {
        return NextResponse.json(
          { error: "Variant not found." },
          { status: 404 }
        );
      }

      availableInventory = Number(variant.inventory || 0);
    }

    if (quantity > availableInventory) {
      return NextResponse.json(
        { error: "Not enough stock available." },
        { status: 400 }
      );
    }

    let { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .maybeSingle();

    if (!cart) {
      const { data: newCart, error: cartError } = await supabase
        .from("carts")
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          status: "active",
        })
        .select("id")
        .single();

      if (cartError || !newCart) {
        return NextResponse.json(
          { error: cartError?.message || "Failed to create cart." },
          { status: 500 }
        );
      }

      cart = newCart;
    }

    let existingQuery = supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cart.id)
      .eq("product_id", productId);

    if (variantId) {
      existingQuery = existingQuery.eq("variant_id", variantId);
    } else {
      existingQuery = existingQuery.is("variant_id", null);
    }

    const { data: existingItem } = await existingQuery.maybeSingle();

    if (existingItem) {
      const newQuantity = Number(existingItem.quantity || 0) + quantity;

      if (newQuantity > availableInventory) {
        return NextResponse.json(
          { error: "Not enough stock available." },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("cart_items")
        .update({
          quantity: newQuantity,
          variant_id: variantId,
        })
        .eq("id", existingItem.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from("cart_items").insert({
        cart_id: cart.id,
        product_id: productId,
        variant_id: variantId,
        quantity,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (contentType.includes("application/json")) {
      return NextResponse.json({
        success: true,
      });
    }

    return NextResponse.redirect(new URL("/cart", request.url));
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to add item to cart." },
      { status: 500 }
    );
  }
}