"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  inventory: number;
  low_stock_threshold: number;
};

type Variant = {
  id: string;
  product_id: string;
  name: string;
  option_name: string;
  option_value: string;
  inventory: number;
  low_stock_threshold: number;
  product:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

export default function DashboardPage() {
  const supabase = createClient();

  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [lowStockVariants, setLowStockVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLowStock = async () => {
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

      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, inventory, low_stock_threshold")
        .eq("tenant_id", profile.tenant_id)
        .order("inventory", { ascending: true });

      const productLowStock = (productsData || []).filter(
        (product) =>
          Number(product.inventory) <=
          Number(product.low_stock_threshold || 5)
      );

      setLowStockProducts(productLowStock);

      const { data: variantsData } = await supabase
        .from("product_variants")
        .select(`
          id,
          product_id,
          name,
          option_name,
          option_value,
          inventory,
          low_stock_threshold,
          product:products (
            id,
            name
          )
        `)
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active")
        .order("inventory", { ascending: true });

      const variantLowStock = (variantsData || []).filter(
        (variant) =>
          Number(variant.inventory) <=
          Number(variant.low_stock_threshold || 5)
      );

      setLowStockVariants(variantLowStock);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStock();
  }, []);

  const getProduct = (variant: Variant) => {
    if (!variant.product) return null;
    return Array.isArray(variant.product)
      ? variant.product[0]
      : variant.product;
  };

  const totalLowStock = lowStockProducts.length + lowStockVariants.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-slate-500 mt-2">
          Overview of your store performance, product stock, and variant stock.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-sm text-slate-500">Low Stock Alerts</p>
          <h2 className="text-3xl font-bold mt-2">{totalLowStock}</h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-sm text-slate-500">Low Stock Products</p>
          <h2 className="text-3xl font-bold mt-2">
            {lowStockProducts.length}
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <p className="text-sm text-slate-500">Low Stock Variants</p>
          <h2 className="text-3xl font-bold mt-2">
            {lowStockVariants.length}
          </h2>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Low Stock Products</h2>
            <p className="text-sm text-slate-500 mt-1">
              Base products at or below their stock threshold.
            </p>
          </div>

          <a
            href="/products"
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Manage Products
          </a>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading low stock products...</p>
        ) : lowStockProducts.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-green-700">
            All base products have healthy stock levels.
          </div>
        ) : (
          <div className="space-y-4">
            {lowStockProducts.map((product) => (
              <div
                key={product.id}
                className="border rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Threshold: {product.low_stock_threshold || 5}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-red-600">
                    {product.inventory}
                  </p>
                  <p className="text-xs text-slate-500">Current stock</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Low Stock Variants</h2>
            <p className="text-sm text-slate-500 mt-1">
              Product options like size, color, or style that need restocking.
            </p>
          </div>

          <a
            href="/products"
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Manage Variants
          </a>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading low stock variants...</p>
        ) : lowStockVariants.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-green-700">
            All variants have healthy stock levels.
          </div>
        ) : (
          <div className="space-y-4">
            {lowStockVariants.map((variant) => {
              const product = getProduct(variant);

              return (
                <div
                  key={variant.id}
                  className="border rounded-2xl p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <h3 className="font-semibold">
                      {product?.name || "Product"} — {variant.name}
                    </h3>

                    <p className="text-sm text-purple-700 mt-1">
                      {variant.option_name}: {variant.option_value}
                    </p>

                    <p className="text-sm text-slate-500 mt-1">
                      Threshold: {variant.low_stock_threshold || 5}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-red-600">
                      {variant.inventory}
                    </p>
                    <p className="text-xs text-slate-500">Current stock</p>
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