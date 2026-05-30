"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReorderButton({
  orderId,
  storeSlug,
}: {
  orderId: string;
  storeSlug?: string | null;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleReorder = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch("/api/cart/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Failed to reorder.");
        return;
      }

      const destination = storeSlug ? `/store/${storeSlug}/cart` : "/cart";

      router.push(destination);
    } catch (error) {
      console.error(error);
      setMessage("Failed to reorder.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleReorder}
        disabled={loading}
        className="w-full border py-3 rounded-2xl text-center text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
      >
        {loading ? "Adding..." : "Reorder"}
      </button>

      {message && <p className="text-xs text-red-600 mt-2">{message}</p>}
    </div>
  );
}