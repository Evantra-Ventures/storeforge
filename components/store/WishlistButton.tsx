"use client";

import { useState } from "react";

type WishlistButtonProps = {
  productId: string;
  initialWishlisted?: boolean;
};

export default function WishlistButton({
  productId,
  initialWishlisted = false,
}: WishlistButtonProps) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [loading, setLoading] = useState(false);

  const toggleWishlist = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/wishlist/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to update wishlist.");
        return;
      }

      setWishlisted(data.wishlisted);
    } catch (error) {
      console.error(error);
      alert("Wishlist update failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleWishlist}
      disabled={loading}
      className="w-full sm:w-auto border px-8 py-4 rounded-2xl font-medium text-center hover:bg-slate-100 transition disabled:opacity-50"
    >
      {loading
        ? "Updating..."
        : wishlisted
          ? "♥ Wishlisted"
          : "♡ Add to Wishlist"}
    </button>
  );
}