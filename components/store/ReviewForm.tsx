"use client";

import { useState } from "react";

export default function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState("5");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const submitReview = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating: Number(rating), title, comment }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to submit review.");
        return;
      }

      alert("Review submitted successfully.");
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-bold">Leave a Review</h3>

      <select
        value={rating}
        onChange={(e) => setRating(e.target.value)}
        className="w-full border rounded-xl p-3"
      >
        <option value="5">5 Stars</option>
        <option value="4">4 Stars</option>
        <option value="3">3 Stars</option>
        <option value="2">2 Stars</option>
        <option value="1">1 Star</option>
      </select>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Review title"
        className="w-full border rounded-xl p-3"
      />

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write your review..."
        className="w-full border rounded-xl p-3 min-h-[120px]"
      />

      <button
        onClick={submitReview}
        disabled={loading}
        className="bg-black text-white px-6 py-3 rounded-xl disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Submit Review"}
      </button>
    </div>
  );
}