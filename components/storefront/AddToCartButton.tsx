"use client";

import { useState } from "react";

import { addToCart } from "@/lib/cart/add-to-cart";

type Props = {
  tenantId: string;
  productId: string;
};

export default function AddToCartButton({
  tenantId,
  productId,
}: Props) {
  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const handleAddToCart = async () => {
    try {
      setLoading(true);

      await addToCart({
        tenantId,
        productId,
      });

      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
      }, 2000);

    } catch (error) {
      console.error(error);

      alert(
        "Failed to add product to cart."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={loading}
      className="bg-black text-white px-8 py-4 rounded-2xl font-medium hover:opacity-90 transition disabled:opacity-50"
    >
      {loading
        ? "Adding..."
        : success
          ? "Added!"
          : "Add to Cart"}
    </button>
  );
}