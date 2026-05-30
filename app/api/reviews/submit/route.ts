import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    const { productId, rating, title, comment } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID is required." },
        { status: 400 }
      );
    }

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5." },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please login to leave a review." },
        { status: 401 }
      );
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select(`
        id,
        tenant_id,
        tenant:tenants (
          id,
          reviews_enabled,
          review_moderation_enabled
        )
      `)
      .eq("id", productId)
      .eq("status", "active")
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    const tenant = Array.isArray(product.tenant)
      ? product.tenant[0]
      : product.tenant;

    if (!tenant?.reviews_enabled) {
      return NextResponse.json(
        { error: "Reviews are disabled for this store." },
        { status: 403 }
      );
    }

    const { data: verifiedOrder } = await supabase
      .from("orders")
      .select(`
        id,
        order_items!inner (
          product_id
        )
      `)
      .eq("customer_id", user.id)
      .eq("tenant_id", product.tenant_id)
      .eq("payment_status", "paid")
      .eq("order_items.product_id", product.id)
      .limit(1)
      .maybeSingle();

    const { data: existingReview } = await supabase
      .from("product_reviews")
      .select("id")
      .eq("product_id", product.id)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (existingReview) {
      return NextResponse.json(
        { error: "You have already reviewed this product." },
        { status: 400 }
      );
    }

    const reviewStatus = tenant.review_moderation_enabled
      ? "pending"
      : "published";

    const { data: review, error: reviewError } = await supabase
      .from("product_reviews")
      .insert({
        tenant_id: product.tenant_id,
        product_id: product.id,
        customer_id: user.id,
        order_id: verifiedOrder?.id || null,
        rating: Number(rating),
        title: title || null,
        comment: comment || null,
        status: reviewStatus,
        is_verified_purchase: !!verifiedOrder,
      })
      .select()
      .single();

    if (reviewError) {
      return NextResponse.json(
        { error: reviewError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review,
      status: reviewStatus,
      message:
        reviewStatus === "pending"
          ? "Review submitted and awaiting approval."
          : "Review published successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to submit review." },
      { status: 500 }
    );
  }
}