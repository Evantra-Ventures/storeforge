"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Review = {
  id: string;
  tenant_id: string;
  product_id: string;
  customer_id: string;
  order_id: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  status: "published" | "hidden" | "pending";
  is_verified_purchase: boolean;
  created_at: string;
  product:
    | {
        id: string;
        name: string;
        image_url: string | null;
      }
    | {
        id: string;
        name: string;
        image_url: string | null;
      }[]
    | null;
};

export default function ReviewsPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchReviews = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return;

      setTenantId(profile.tenant_id);

      const { data, error } = await supabase
        .from("product_reviews")
        .select(`
          *,
          product:products (
            id,
            name,
            image_url
          )
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        alert(error.message);
        return;
      }

      setReviews(data || []);
    } catch (error) {
      console.error(error);
      alert("Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  };

  const getProduct = (review: Review) => {
    if (!review.product) return null;
    return Array.isArray(review.product) ? review.product[0] : review.product;
  };

  const updateReviewStatus = async (
    reviewId: string,
    status: "published" | "hidden" | "pending"
  ) => {
    if (!tenantId) return;

    try {
      setUpdatingId(reviewId);

      const { error } = await supabase
        .from("product_reviews")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reviewId)
        .eq("tenant_id", tenantId);

      if (error) {
        alert(error.message);
        return;
      }

      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId ? { ...review, status } : review
        )
      );
    } catch (error) {
      console.error(error);
      alert("Failed to update review.");
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteReview = async (reviewId: string) => {
    if (!tenantId) return;

    const confirmed = confirm("Delete this review permanently?");
    if (!confirmed) return;

    try {
      setUpdatingId(reviewId);

      const { error } = await supabase
        .from("product_reviews")
        .delete()
        .eq("id", reviewId)
        .eq("tenant_id", tenantId);

      if (error) {
        alert(error.message);
        return;
      }

      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
    } catch (error) {
      console.error(error);
      alert("Failed to delete review.");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const publishedCount = reviews.filter(
    (review) => review.status === "published"
  ).length;

  const hiddenCount = reviews.filter((review) => review.status === "hidden")
    .length;

  const pendingCount = reviews.filter((review) => review.status === "pending")
    .length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Reviews</h1>
        <p className="text-slate-500 mt-2">
          Moderate product reviews for your store.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-sm text-slate-500">Total Reviews</p>
          <h2 className="text-3xl font-bold mt-2">{reviews.length}</h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-sm text-slate-500">Published</p>
          <h2 className="text-3xl font-bold mt-2">{publishedCount}</h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-sm text-slate-500">Hidden</p>
          <h2 className="text-3xl font-bold mt-2">{hiddenCount}</h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-sm text-slate-500">Pending</p>
          <h2 className="text-3xl font-bold mt-2">{pendingCount}</h2>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">All Reviews</h2>

          <span className="text-sm text-slate-500">
            {reviews.length} review(s)
          </span>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No reviews yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const product = getProduct(review);

              return (
                <div
                  key={review.id}
                  className="border rounded-2xl p-5 flex flex-col lg:flex-row gap-5 lg:items-start lg:justify-between"
                >
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                      {product?.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">
                          No Image
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          {product?.name || "Deleted product"}
                        </h3>

                        <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-md text-xs">
                          {"⭐".repeat(Number(review.rating))}
                        </span>

                        <span className="bg-slate-100 px-2 py-1 rounded-md text-xs capitalize">
                          {review.status}
                        </span>

                        {review.is_verified_purchase && (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs">
                            Verified purchase
                          </span>
                        )}
                      </div>

                      {review.title && (
                        <p className="font-medium mt-3">{review.title}</p>
                      )}

                      {review.comment && (
                        <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                          {review.comment}
                        </p>
                      )}

                      <p className="text-xs text-slate-400 mt-3">
                        {new Date(review.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      onClick={() =>
                        updateReviewStatus(review.id, "published")
                      }
                      disabled={
                        updatingId === review.id ||
                        review.status === "published"
                      }
                      className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50"
                    >
                      Publish
                    </button>

                    <button
                      onClick={() => updateReviewStatus(review.id, "hidden")}
                      disabled={
                        updatingId === review.id || review.status === "hidden"
                      }
                      className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50"
                    >
                      Hide
                    </button>

                    <button
                      onClick={() => deleteReview(review.id)}
                      disabled={updatingId === review.id}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}