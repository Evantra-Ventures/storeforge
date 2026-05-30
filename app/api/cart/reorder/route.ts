import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, tenant_id, customer_id")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        id,
        product_id,
        variant_id,
        quantity,
        product:products (
          id,
          status,
          inventory
        ),
        variant:product_variants (
          id,
          status,
          inventory
        )
      `)
      .eq("order_id", order.id);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!orderItems || orderItems.length === 0) {
      return NextResponse.json(
        { error: "This order has no items to reorder." },
        { status: 400 }
      );
    }

    let skippedItems = 0;

    const validItems = (orderItems as any[]).filter((item) => {
      const product = Array.isArray(item.product)
        ? item.product[0]
        : item.product;

      const variant = Array.isArray(item.variant)
        ? item.variant[0]
        : item.variant;

      if (!product || product.status !== "active") {
        skippedItems += 1;
        return false;
      }

      if (item.variant_id) {
        if (!variant || variant.status !== "active") {
          skippedItems += 1;
          return false;
        }

        if (Number(variant.inventory || 0) <= 0) {
          skippedItems += 1;
          return false;
        }

        return true;
      }

      if (Number(product.inventory || 0) <= 0) {
        skippedItems += 1;
        return false;
      }

      return true;
    });

    if (validItems.length === 0) {
      return NextResponse.json(
        {
          error:
            "None of the items from this order are currently available to reorder.",
        },
        { status: 400 }
      );
    }

    let { data: cart } = await supabase
      .from("carts")
      .select("id")
      .eq("tenant_id", order.tenant_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!cart) {
      const { data: newCart, error: cartCreateError } = await supabase
        .from("carts")
        .insert({
          tenant_id: order.tenant_id,
          user_id: user.id,
          status: "active",
        })
        .select("id")
        .single();

      if (cartCreateError || !newCart) {
        return NextResponse.json(
          { error: cartCreateError?.message || "Failed to create cart." },
          { status: 500 }
        );
      }

      cart = newCart;
    }

    for (const item of validItems) {
      const quantity = Math.max(1, Number(item.quantity || 1));

      let query = supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cart.id)
        .eq("product_id", item.product_id);

      if (item.variant_id) {
        query = query.eq("variant_id", item.variant_id);
      } else {
        query = query.is("variant_id", null);
      }

      const { data: existingItem } = await query.maybeSingle();

      if (existingItem) {
        await supabase
          .from("cart_items")
          .update({
            quantity: Number(existingItem.quantity || 0) + quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingItem.id);
      } else {
        await supabase.from("cart_items").insert({
          cart_id: cart.id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity,
        });
      }
    }

    return NextResponse.json({
      success: true,
      cartId: cart.id,
      addedItems: validItems.length,
      skippedItems,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to reorder items." },
      { status: 500 }
    );
  }
}