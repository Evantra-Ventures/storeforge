import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required." },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 }
      );
    }

    const { data: product } = await supabase
      .from("products")
      .select("id, tenant_id")
      .eq("id", productId)
      .eq("status", "active")
      .single();

    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    const { data: existing } = await supabase
      .from("wishlists")
      .select("id")
      .eq("tenant_id", product.tenant_id)
      .eq("product_id", product.id)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("wishlists")
        .delete()
        .eq("id", existing.id)
        .eq("customer_id", user.id);

      return NextResponse.json({
        success: true,
        wishlisted: false,
      });
    }

    const { error } = await supabase.from("wishlists").insert({
      tenant_id: product.tenant_id,
      product_id: product.id,
      customer_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      wishlisted: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Wishlist update failed." },
      { status: 500 }
    );
  }
}