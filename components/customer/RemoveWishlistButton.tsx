"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RemoveWishlistButton({
  wishlistId,
}: {
  wishlistId: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [removing, setRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleRemove = async () => {
    const confirmed = confirm("Remove this product from your wishlist?");

    if (!confirmed) return;

    try {
      setRemoving(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("id", wishlistId)
        .eq("customer_id", user.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to remove item.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="sm:col-span-2">
      <button
        onClick={handleRemove}
        disabled={removing}
        className="w-full border border-red-200 text-red-600 py-3 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50"
      >
        {removing ? "Removing..." : "Remove from Wishlist"}
      </button>

      {errorMessage && (
        <p className="text-xs text-red-600 mt-2">{errorMessage}</p>
      )}
    </div>
  );
}