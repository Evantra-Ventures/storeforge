"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FileUploader from "@/components/ui/FileUploader";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Review = {
  rating: number;
  status: string;
};

type ProductVariant = {
  id: string;
  product_id: string;
  tenant_id: string;
  name: string;
  sku: string | null;
  option_name: string;
  option_value: string;
  price_adjustment: number;
  inventory: number;
  low_stock_threshold: number;
  image_url: string | null;
  status: string;
};

type Product = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  inventory: number;
  low_stock_threshold: number;
  image_url: string | null;
  status: string;
  created_at: string;
  category?: Category | Category[] | null;
  reviews?: Review[] | null;
  variants?: ProductVariant[] | null;
};

export default function ProductsPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null
  );

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [inventory, setInventory] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("active");

  const [variantName, setVariantName] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [variantOptionName, setVariantOptionName] = useState("Size");
  const [variantOptionValue, setVariantOptionValue] = useState("");
  const [variantPriceAdjustment, setVariantPriceAdjustment] = useState("0");
  const [variantInventory, setVariantInventory] = useState("");
  const [variantLowStockThreshold, setVariantLowStockThreshold] = useState("5");
  const [variantImageUrl, setVariantImageUrl] = useState("");
  const [variantStatus, setVariantStatus] = useState("active");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [loading, setLoading] = useState(false);
  const [variantLoading, setVariantLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

  const getProductCategory = (product: Product) => {
    if (!product.category) return null;
    return Array.isArray(product.category)
      ? product.category[0]
      : product.category;
  };

  const getProductVariants = (product: Product) => product.variants || [];

  const isLowStock = (product: Product) =>
    Number(product.inventory) <= Number(product.low_stock_threshold || 5);

  const isVariantLowStock = (variant: ProductVariant) =>
    Number(variant.inventory) <= Number(variant.low_stock_threshold || 5);

  const getReviewStats = (product: Product) => {
    const publishedReviews = (product.reviews || []).filter(
      (review) => review.status === "published"
    );

    const reviewCount = publishedReviews.length;

    const averageRating =
      reviewCount > 0
        ? publishedReviews.reduce(
          (acc, review) => acc + Number(review.rating),
          0
        ) / reviewCount
        : 0;

    return { reviewCount, averageRating };
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.description || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesCategory =
        !filterCategoryId || product.category_id === filterCategoryId;

      const matchesStatus = !filterStatus || product.status === filterStatus;

      const matchesLowStock = !lowStockOnly || isLowStock(product);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesLowStock
      );
    });
  }, [products, searchTerm, filterCategoryId, filterStatus, lowStockOnly]);

  const lowStockCount = products.filter(isLowStock).length;

  const resetForm = () => {
    setEditingProductId(null);
    setName("");
    setCategoryId("");
    setDescription("");
    setPrice("");
    setInventory("");
    setLowStockThreshold("5");
    setImageUrl("");
    setStatus("active");
    setErrorMessage("");
  };

  const resetVariantForm = () => {
    setEditingVariantId(null);
    setVariantName("");
    setVariantSku("");
    setVariantOptionName("Size");
    setVariantOptionValue("");
    setVariantPriceAdjustment("0");
    setVariantInventory("");
    setVariantLowStockThreshold("5");
    setVariantImageUrl("");
    setVariantStatus("active");
  };

  const resetFilters = () => {
    setSearchTerm("");
    setFilterCategoryId("");
    setFilterStatus("");
    setLowStockOnly(false);
  };

  const fetchData = async () => {
    try {
      setFetching(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) return;

      setTenantId(profile.tenant_id);

      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id,name,slug")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      setCategories(categoriesData || []);

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select(`
          *,
          category:categories (
            id,
            name,
            slug
          ),
          reviews:product_reviews (
            rating,
            status
          ),
          variants:product_variants (
            id,
            tenant_id,
            product_id,
            name,
            sku,
            option_name,
            option_value,
            price_adjustment,
            inventory,
            low_stock_threshold,
            image_url,
            status
          )
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (productsError) {
        setErrorMessage(productsError.message);
        return;
      }

      setProducts(productsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load products.");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const validateForm = () => {
    if (!name.trim()) {
      setErrorMessage("Product name is required.");
      return false;
    }

    if (!price || Number(price) < 0) {
      setErrorMessage("Valid product price is required.");
      return false;
    }

    if (Number(inventory || 0) < 0) {
      setErrorMessage("Inventory cannot be negative.");
      return false;
    }

    if (Number(lowStockThreshold || 0) < 0) {
      setErrorMessage("Low stock threshold cannot be negative.");
      return false;
    }

    if (!tenantId) {
      setErrorMessage("Tenant not found.");
      return false;
    }

    return true;
  };

  const validateVariantForm = () => {
    if (!tenantId || !expandedProductId) {
      setErrorMessage("Product not selected.");
      return false;
    }

    if (!variantName.trim()) {
      setErrorMessage("Variant name is required.");
      return false;
    }

    if (!variantOptionName.trim()) {
      setErrorMessage("Variant option name is required.");
      return false;
    }

    if (!variantOptionValue.trim()) {
      setErrorMessage("Variant option value is required.");
      return false;
    }

    if (Number(variantInventory || 0) < 0) {
      setErrorMessage("Variant inventory cannot be negative.");
      return false;
    }

    if (Number(variantLowStockThreshold || 0) < 0) {
      setErrorMessage("Variant low stock threshold cannot be negative.");
      return false;
    }

    return true;
  };

  const handleCreateProduct = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      if (!validateForm()) return;

      const { error } = await supabase.from("products").insert({
        tenant_id: tenantId,
        category_id: categoryId || null,
        name,
        slug: generateSlug(name),
        description,
        price: Number(price),
        inventory: Number(inventory || 0),
        low_stock_threshold: Number(lowStockThreshold || 5),
        image_url: imageUrl || null,
        status,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      resetForm();
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const logWishlistNotificationAudit = async ({
    action,
    entityType,
    entityId,
    notifiedCount,
    metadata,
  }: {
    action: string;
    entityType: string;
    entityId: string;
    notifiedCount: number;
    metadata: Record<string, any>;
  }) => {
    if (!tenantId || notifiedCount <= 0) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("audit_logs").insert({
        tenant_id: tenantId,
        actor_id: user?.id || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        severity: "info",
        description: `${notifiedCount} wishlist customer(s) notified.`,
        metadata: {
          ...metadata,
          notified_count: notifiedCount,
        },
      });
    } catch (auditError) {
      console.error("Wishlist notification audit error:", auditError);
    }
  };

  const runProductWishlistNotifications = async ({
    previousProduct,
    productId,
    newPrice,
    newInventory,
  }: {
    previousProduct: Product;
    productId: string;
    newPrice: number;
    newInventory: number;
  }) => {
    try {
      const previousInventory = Number(previousProduct.inventory || 0);
      const previousPrice = Number(previousProduct.price || 0);

      if (previousInventory <= 0 && newInventory > 0) {
        const { data, error } = await supabase.rpc(
          "notify_wishlist_product_back_in_stock",
          {
            p_product_id: productId,
            p_previous_inventory: previousInventory,
            p_new_inventory: newInventory,
          }
        );

        if (error) {
          console.error("Wishlist product back-in-stock error:", error);
        } else {
          await logWishlistNotificationAudit({
            action: "wishlist_product_back_in_stock_notification",
            entityType: "product",
            entityId: productId,
            notifiedCount: Number(data || 0),
            metadata: {
              product_id: productId,
              previous_inventory: previousInventory,
              new_inventory: newInventory,
            },
          });
        }
      }

      if (newPrice < previousPrice) {
        const { data, error } = await supabase.rpc(
          "notify_wishlist_product_price_drop",
          {
            p_product_id: productId,
            p_previous_price: previousPrice,
            p_new_price: newPrice,
          }
        );

        if (error) {
          console.error("Wishlist product price-drop error:", error);
        } else {
          await logWishlistNotificationAudit({
            action: "wishlist_product_price_drop_notification",
            entityType: "product",
            entityId: productId,
            notifiedCount: Number(data || 0),
            metadata: {
              product_id: productId,
              previous_price: previousPrice,
              new_price: newPrice,
            },
          });
        }
      }
    } catch (notificationError) {
      console.error("Product wishlist notification failed:", notificationError);
    }
  };

  const runVariantWishlistNotifications = async ({
    previousVariant,
    variantId,
    newInventory,
    newPriceAdjustment,
  }: {
    previousVariant: ProductVariant;
    variantId: string;
    newInventory: number;
    newPriceAdjustment: number;
  }) => {
    try {
      const previousInventory = Number(previousVariant.inventory || 0);
      const previousPriceAdjustment = Number(
        previousVariant.price_adjustment || 0
      );

      if (previousInventory <= 0 && newInventory > 0) {
        const { data, error } = await supabase.rpc(
          "notify_wishlist_variant_back_in_stock",
          {
            p_variant_id: variantId,
            p_previous_inventory: previousInventory,
            p_new_inventory: newInventory,
          }
        );

        if (error) {
          console.error("Wishlist variant back-in-stock error:", error);
        } else {
          await logWishlistNotificationAudit({
            action: "wishlist_variant_back_in_stock_notification",
            entityType: "product_variant",
            entityId: variantId,
            notifiedCount: Number(data || 0),
            metadata: {
              variant_id: variantId,
              product_id: previousVariant.product_id,
              previous_inventory: previousInventory,
              new_inventory: newInventory,
            },
          });
        }
      }

      if (newPriceAdjustment < previousPriceAdjustment) {
        const { data, error } = await supabase.rpc(
          "notify_wishlist_variant_price_drop",
          {
            p_variant_id: variantId,
            p_previous_price_adjustment: previousPriceAdjustment,
            p_new_price_adjustment: newPriceAdjustment,
          }
        );

        if (error) {
          console.error("Wishlist variant price-drop error:", error);
        } else {
          await logWishlistNotificationAudit({
            action: "wishlist_variant_price_drop_notification",
            entityType: "product_variant",
            entityId: variantId,
            notifiedCount: Number(data || 0),
            metadata: {
              variant_id: variantId,
              product_id: previousVariant.product_id,
              previous_price_adjustment: previousPriceAdjustment,
              new_price_adjustment: newPriceAdjustment,
            },
          });
        }
      }
    } catch (notificationError) {
      console.error("Variant wishlist notification failed:", notificationError);
    }
  };

  const handleUpdateProduct = async (productId: string) => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!validateForm() || !tenantId) return;

      const previousProduct = products.find((product) => product.id === productId);

      if (!previousProduct) {
        setErrorMessage("Previous product data not found.");
        return;
      }

      const newPrice = Number(price);
      const newInventory = Number(inventory || 0);

      const { error } = await supabase
        .from("products")
        .update({
          category_id: categoryId || null,
          name,
          slug: generateSlug(name),
          description,
          price: newPrice,
          inventory: newInventory,
          low_stock_threshold: Number(lowStockThreshold || 5),
          image_url: imageUrl || null,
          status,
        })
        .eq("id", productId)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await runProductWishlistNotifications({
        previousProduct,
        productId,
        newPrice,
        newInventory,
      });

      setSuccessMessage("Product updated successfully.");
      resetForm();
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!tenantId) return;

    if (!confirm("Are you sure you want to delete this product?")) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("tenant_id", tenantId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    fetchData();
  };

  const handleCreateVariant = async () => {
    try {
      setVariantLoading(true);
      setErrorMessage("");

      if (!validateVariantForm()) return;

      const { error } = await supabase.from("product_variants").insert({
        tenant_id: tenantId,
        product_id: expandedProductId,
        name: variantName,
        sku: variantSku || null,
        option_name: variantOptionName,
        option_value: variantOptionValue,
        price_adjustment: Number(variantPriceAdjustment || 0),
        inventory: Number(variantInventory || 0),
        low_stock_threshold: Number(variantLowStockThreshold || 5),
        image_url: variantImageUrl || null,
        status: variantStatus,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      resetVariantForm();
      fetchData();
    } finally {
      setVariantLoading(false);
    }
  };

  const handleUpdateVariant = async () => {
    if (!editingVariantId || !tenantId) return;

    try {
      setVariantLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!validateVariantForm()) return;

      const previousVariant = products
        .flatMap((product) => product.variants || [])
        .find((variant) => variant.id === editingVariantId);

      if (!previousVariant) {
        setErrorMessage("Previous variant data not found.");
        return;
      }

      const newInventory = Number(variantInventory || 0);
      const newPriceAdjustment = Number(variantPriceAdjustment || 0);

      const { error } = await supabase
        .from("product_variants")
        .update({
          name: variantName,
          sku: variantSku || null,
          option_name: variantOptionName,
          option_value: variantOptionValue,
          price_adjustment: newPriceAdjustment,
          inventory: newInventory,
          low_stock_threshold: Number(variantLowStockThreshold || 5),
          image_url: variantImageUrl || null,
          status: variantStatus,
        })
        .eq("id", editingVariantId)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      await runVariantWishlistNotifications({
        previousVariant,
        variantId: editingVariantId,
        newInventory,
        newPriceAdjustment,
      });

      setSuccessMessage("Variant updated successfully.");
      resetVariantForm();
      fetchData();
    } finally {
      setVariantLoading(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!tenantId) return;

    if (!confirm("Delete this variant?")) return;

    const { error } = await supabase
      .from("product_variants")
      .delete()
      .eq("id", variantId)
      .eq("tenant_id", tenantId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    resetVariantForm();
    fetchData();
  };

  const handleEditClick = (product: Product) => {
    setEditingProductId(product.id);
    setName(product.name);
    setCategoryId(product.category_id || "");
    setDescription(product.description || "");
    setPrice(product.price.toString());
    setInventory(product.inventory.toString());
    setLowStockThreshold((product.low_stock_threshold || 5).toString());
    setImageUrl(product.image_url || "");
    setStatus(product.status || "active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditVariantClick = (variant: ProductVariant) => {
    setEditingVariantId(variant.id);
    setVariantName(variant.name);
    setVariantSku(variant.sku || "");
    setVariantOptionName(variant.option_name || "Size");
    setVariantOptionValue(variant.option_value || "");
    setVariantPriceAdjustment(
      Number(variant.price_adjustment || 0).toString()
    );
    setVariantInventory(Number(variant.inventory || 0).toString());
    setVariantLowStockThreshold(
      Number(variant.low_stock_threshold || 5).toString()
    );
    setVariantImageUrl(variant.image_url || "");
    setVariantStatus(variant.status || "active");
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Products</h1>
        <p className="text-slate-500 mt-2">
          Manage products, variants, stock alerts, categories, and reviews.
        </p>
      </div>

      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5">
          <p className="font-semibold">Low stock alert</p>
          <p className="text-sm mt-1">
            {lowStockCount} product(s) are at or below their low stock threshold.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold">
          {editingProductId ? "Edit Product" : "Create Product"}
        </h2>

        {errorMessage && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 text-green-700 p-4 rounded-xl">
            {successMessage}
          </div>
        )}

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          className="w-full border rounded-xl p-3"
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full border rounded-xl p-3"
        >
          <option value="">No Category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your product..."
          className="w-full border rounded-xl p-3 min-h-[120px]"
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Base price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border rounded-xl p-3"
          />

          <input
            type="number"
            min="0"
            placeholder="Base inventory"
            value={inventory}
            onChange={(e) => setInventory(e.target.value)}
            className="w-full border rounded-xl p-3"
          />

          <input
            type="number"
            min="0"
            placeholder="Low stock threshold"
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            className="w-full border rounded-xl p-3"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border rounded-xl p-3"
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {tenantId && (
          <FileUploader
            bucket="product-images"
            tenantId={tenantId}
            folder="products"
            label="Upload Product Image"
            onUploadComplete={(url) => setImageUrl(url)}
          />
        )}

        {imageUrl && (
          <img
            src={imageUrl}
            alt="Preview"
            className="w-40 h-40 object-cover rounded-xl border"
          />
        )}

        <div className="flex gap-3">
          <button
            onClick={() =>
              editingProductId
                ? handleUpdateProduct(editingProductId)
                : handleCreateProduct()
            }
            disabled={loading}
            className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {loading
              ? "Saving..."
              : editingProductId
                ? "Update Product"
                : "Create Product"}
          </button>

          {editingProductId && (
            <button onClick={resetForm} className="border px-6 py-3 rounded-xl">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Filter Products</h2>

          <button
            onClick={resetFilters}
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products..."
            className="border rounded-xl p-3"
          />

          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          <label className="border rounded-xl p-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            Low stock only
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Your Products</h2>
          <span className="text-sm text-slate-500">
            {filteredProducts.length} Product(s)
          </span>
        </div>

        {fetching ? (
          <p className="text-slate-500">Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-slate-500 text-center py-12">No products found.</p>
        ) : (
          <div className="space-y-5">
            {filteredProducts.map((product) => {
              const category = getProductCategory(product);
              const variants = getProductVariants(product);
              const { reviewCount, averageRating } = getReviewStats(product);

              return (
                <div key={product.id} className="border rounded-2xl p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                        {product.image_url ? (
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
                        <h3 className="font-semibold text-lg">
                          {product.name}
                        </h3>

                        <p className="text-sm text-slate-500">
                          {product.description || "No description"}
                        </p>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="bg-slate-100 px-2 py-1 rounded-md text-xs capitalize">
                            {product.status}
                          </span>

                          {category && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs">
                              {category.name}
                            </span>
                          )}

                          {isLowStock(product) && (
                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs">
                              Low stock
                            </span>
                          )}

                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md text-xs">
                            {variants.length} variant(s)
                          </span>

                          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-md text-xs">
                            ⭐{" "}
                            {reviewCount > 0
                              ? `${averageRating.toFixed(1)} (${reviewCount})`
                              : "No reviews"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        ${Number(product.price).toFixed(2)}
                      </p>

                      <p className="text-sm text-slate-500 mt-1">
                        Stock: {product.inventory}
                      </p>

                      <div className="flex gap-2 mt-4 justify-end flex-wrap">
                        <button
                          onClick={() =>
                            setExpandedProductId(
                              expandedProductId === product.id
                                ? null
                                : product.id
                            )
                          }
                          className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-100"
                        >
                          {expandedProductId === product.id
                            ? "Hide Variants"
                            : "Manage Variants"}
                        </button>

                        <button
                          onClick={() => handleEditClick(product)}
                          className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-100"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  {expandedProductId === product.id && (
                    <div className="mt-6 border-t pt-6 space-y-6">
                      <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                        <h3 className="font-semibold">
                          {editingVariantId ? "Edit Variant" : "Create Variant"}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <input
                            value={variantName}
                            onChange={(e) => setVariantName(e.target.value)}
                            placeholder="Variant name e.g. Black / Large"
                            className="border rounded-xl p-3"
                          />

                          <input
                            value={variantSku}
                            onChange={(e) => setVariantSku(e.target.value)}
                            placeholder="SKU optional"
                            className="border rounded-xl p-3"
                          />

                          <input
                            value={variantOptionName}
                            onChange={(e) =>
                              setVariantOptionName(e.target.value)
                            }
                            placeholder="Option name e.g. Size"
                            className="border rounded-xl p-3"
                          />

                          <input
                            value={variantOptionValue}
                            onChange={(e) =>
                              setVariantOptionValue(e.target.value)
                            }
                            placeholder="Option value e.g. XL"
                            className="border rounded-xl p-3"
                          />

                          <input
                            type="number"
                            step="0.01"
                            value={variantPriceAdjustment}
                            onChange={(e) =>
                              setVariantPriceAdjustment(e.target.value)
                            }
                            placeholder="Price adjustment"
                            className="border rounded-xl p-3"
                          />

                          <input
                            type="number"
                            min="0"
                            value={variantInventory}
                            onChange={(e) =>
                              setVariantInventory(e.target.value)
                            }
                            placeholder="Variant inventory"
                            className="border rounded-xl p-3"
                          />

                          <input
                            type="number"
                            min="0"
                            value={variantLowStockThreshold}
                            onChange={(e) =>
                              setVariantLowStockThreshold(e.target.value)
                            }
                            placeholder="Low stock threshold"
                            className="border rounded-xl p-3"
                          />

                          <select
                            value={variantStatus}
                            onChange={(e) => setVariantStatus(e.target.value)}
                            className="border rounded-xl p-3"
                          >
                            <option value="active">Active</option>
                            <option value="draft">Draft</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>

                        {tenantId && (
                          <FileUploader
                            bucket="product-images"
                            tenantId={tenantId}
                            folder="variants"
                            label="Upload Variant Image"
                            onUploadComplete={(url) => setVariantImageUrl(url)}
                          />
                        )}

                        {variantImageUrl && (
                          <img
                            src={variantImageUrl}
                            alt="Variant preview"
                            className="w-28 h-28 object-cover rounded-xl border"
                          />
                        )}

                        <div className="flex gap-3">
                          <button
                            onClick={
                              editingVariantId
                                ? handleUpdateVariant
                                : handleCreateVariant
                            }
                            disabled={variantLoading}
                            className="bg-black text-white px-5 py-3 rounded-xl text-sm disabled:opacity-50"
                          >
                            {variantLoading
                              ? "Saving..."
                              : editingVariantId
                                ? "Update Variant"
                                : "Create Variant"}
                          </button>

                          {editingVariantId && (
                            <button
                              onClick={resetVariantForm}
                              className="border px-5 py-3 rounded-xl text-sm"
                            >
                              Cancel Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {variants.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No variants yet.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {variants.map((variant) => (
                            <div
                              key={variant.id}
                              className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                                  {variant.image_url ? (
                                    <img
                                      src={variant.image_url}
                                      alt={variant.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs text-slate-400">
                                      No Image
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <h4 className="font-semibold">
                                    {variant.name}
                                  </h4>

                                  <p className="text-sm text-slate-500">
                                    {variant.option_name}:{" "}
                                    {variant.option_value}
                                  </p>

                                  <div className="flex gap-2 mt-2 flex-wrap">
                                    <span className="bg-slate-100 px-2 py-1 rounded-md text-xs capitalize">
                                      {variant.status}
                                    </span>

                                    {variant.sku && (
                                      <span className="text-xs text-slate-500">
                                        SKU: {variant.sku}
                                      </span>
                                    )}

                                    {isVariantLowStock(variant) && (
                                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs">
                                        Low stock
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="font-bold">
                                  Adjustment: $
                                  {Number(
                                    variant.price_adjustment || 0
                                  ).toFixed(2)}
                                </p>

                                <p className="text-sm text-slate-500">
                                  Stock: {variant.inventory}
                                </p>

                                <div className="flex gap-2 mt-3 justify-end">
                                  <button
                                    onClick={() =>
                                      handleEditVariantClick(variant)
                                    }
                                    className="border px-3 py-2 rounded-lg text-sm"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeleteVariant(variant.id)
                                    }
                                    className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}