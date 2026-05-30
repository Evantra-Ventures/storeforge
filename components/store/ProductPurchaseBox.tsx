"use client";

import { useMemo, useState } from "react";
import WishlistButton from "@/components/store/WishlistButton";

type Variant = {
  id: string;
  name: string;
  option_name: string;
  option_value: string;
  price_adjustment: number;
  inventory: number;
  image_url: string | null;
};

export default function ProductPurchaseBox({
  tenantId,
  productId,
  basePrice,
  baseInventory,
  currency,
  variants,
  initialWishlisted,
}: {
  tenantId: string;
  productId: string;
  basePrice: number;
  baseInventory: number;
  currency: string;
  variants: Variant[];
  initialWishlisted: boolean;
}) {
  const [variantId, setVariantId] = useState("");

  const selectedVariant = variants.find((variant) => variant.id === variantId);

  const finalPrice = useMemo(() => {
    return basePrice + Number(selectedVariant?.price_adjustment || 0);
  }, [basePrice, selectedVariant]);

  const stock = selectedVariant ? selectedVariant.inventory : baseInventory;
  const isOutOfStock = Number(stock || 0) <= 0;

  return (
    <div className="mt-10 space-y-5">
      {variants.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Choose option
          </label>

          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="w-full border rounded-xl p-3"
          >
            <option value="">Default option</option>

            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.option_name}: {variant.option_value} — {currency}{" "}
                {(basePrice + Number(variant.price_adjustment || 0)).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p className="text-4xl font-bold">
          {currency} {finalPrice.toFixed(2)}
        </p>

        <p className="text-sm text-slate-500 mt-2">
          {isOutOfStock ? "Out of stock" : `${stock} in stock`}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <form action="/api/cart/add" method="POST">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="variantId" value={variantId} />
          <input type="hidden" name="quantity" value="1" />

          <button
            disabled={isOutOfStock}
            className="w-full sm:w-auto bg-black text-white px-8 py-4 rounded-2xl font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            Add to Cart
          </button>
        </form>

        <WishlistButton
          productId={productId}
          initialWishlisted={initialWishlisted}
        />
      </div>
    </div>
  );
}