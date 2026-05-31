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

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  currency: string | null;
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

function money(currency: string, amount: number) {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function statusClass(status: string) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "draft") return "bg-yellow-100 text-yellow-700";
  return "bg-slate-100 text-slate-700";
}

export default function ProductsPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
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

  const currency = tenant?.currency || "GHS";

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

  const getLowestProductPrice = (product: Product) => {
    const activeVariants = (product.variants || []).filter(
      (variant) => variant.status === "active"
    );

    if (activeVariants.length === 0) return Number(product.price || 0);

    return Math.min(
      ...activeVariants.map(
        (variant) =>
          Number(product.price || 0) + Number(variant.price_adjustment || 0)
      )
    );
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

  const activeProducts = products.filter(
    (product) => product.status === "active"
  ).length;

  const draftProducts = products.filter(
    (product) => product.status === "draft"
  ).length;

  const archivedProducts = products.filter(
    (product) => product.status === "archived"
  ).length;

  const totalInventory = products.reduce(
    (sum, product) => sum + Number(product.inventory || 0),
    0
  );

  const totalVariants = products.reduce(
    (sum, product) => sum + Number(product.variants?.length || 0),
    0
  );

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

      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id,name,slug,logo_url,currency")
        .eq("id", profile.tenant_id)
        .single();

      setTenant(tenantData || null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSuccessMessage("");

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

      setSuccessMessage("Product created successfully.");
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

      const previousProduct = products.find(
        (product) => product.id === productId
      );

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

    setSuccessMessage("Product deleted successfully.");
    fetchData();
  };

  const handleCreateVariant = async () => {
    try {
      setVariantLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

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

      setSuccessMessage("Variant created successfully.");
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

    setSuccessMessage("Variant deleted successfully.");
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
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%)]" />

        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
          <div className="lg:col-span-2">
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Merchant product center
            </div>

            <div className="flex items-center gap-4">
              {tenant?.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="h-16 w-16 rounded-2xl border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-slate-950">
                  {tenant?.name?.slice(0, 1) || "S"}
                </div>
              )}

              <div>
                <p className="text-sm text-slate-300">Catalog management</p>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                  Products
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              Manage products, variants, stock alerts, categories, reviews, and
              wishlist-triggered customer notifications from one polished page.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href={tenant ? `/store/${tenant.slug}` : "/"}
                className="rounded-2xl bg-white px-6 py-4 text-center font-semibold text-slate-950 hover:bg-slate-200"
              >
                View storefront
              </a>

              <a
                href="/categories"
                className="rounded-2xl border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10"
              >
                Manage categories
              </a>

              <a
                href="/dashboard"
                className="rounded-2xl border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10"
              >
                Dashboard overview
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white p-4 text-slate-950 shadow-2xl">
            <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
              <p className="text-sm text-slate-300">Catalog snapshot</p>
              <h2 className="mt-2 text-4xl font-bold">{products.length}</h2>
              <p className="mt-1 text-sm text-slate-300">total product(s)</p>

              <div className="mt-6 space-y-3">
                <HeroMiniRow label="Active products" value={activeProducts} />
                <HeroMiniRow label="Draft products" value={draftProducts} />
                <HeroMiniRow label="Low stock" value={lowStockCount} />
                <HeroMiniRow label="Variants" value={totalVariants} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total products"
          value={products.length}
          helper="All catalog items"
        />
        <StatCard
          label="Active"
          value={activeProducts}
          helper="Visible on storefront"
        />
        <StatCard
          label="Inventory"
          value={totalInventory}
          helper="Base product stock"
        />
        <StatCard
          label="Low stock"
          value={lowStockCount}
          helper="Needs attention"
          danger={lowStockCount > 0}
        />
      </section>

      {lowStockCount > 0 && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
          <p className="font-semibold">Low stock alert</p>
          <p className="mt-1 text-sm">
            {lowStockCount} product(s) are at or below their low stock
            threshold. Update inventory to avoid missed orders.
          </p>
        </div>
      )}

      {(errorMessage || successMessage) && (
        <div className="space-y-3">
          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
              {successMessage}
            </div>
          )}
        </div>
      )}

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Product editor
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {editingProductId ? "Edit product" : "Create product"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Add product details, pricing, inventory, image, category, and
              storefront status.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <InputField
              label="Product name"
              value={name}
              onChange={setName}
              placeholder="Product name"
            />

            <SelectField
              label="Category"
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { label: "No Category", value: "" },
                ...categories.map((category) => ({
                  label: category.name,
                  value: category.id,
                })),
              ]}
            />

            <TextAreaField
              label="Description"
              value={description}
              onChange={setDescription}
              placeholder="Describe your product..."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <InputField
                label="Base price"
                type="number"
                value={price}
                onChange={setPrice}
                placeholder="0.00"
              />

              <InputField
                label="Base inventory"
                type="number"
                value={inventory}
                onChange={setInventory}
                placeholder="0"
              />

              <InputField
                label="Low stock threshold"
                type="number"
                value={lowStockThreshold}
                onChange={setLowStockThreshold}
                placeholder="5"
              />

              <SelectField
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { label: "Active", value: "active" },
                  { label: "Draft", value: "draft" },
                  { label: "Archived", value: "archived" },
                ]}
              />
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
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="h-40 w-40 rounded-xl object-cover"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() =>
                  editingProductId
                    ? handleUpdateProduct(editingProductId)
                    : handleCreateProduct()
                }
                disabled={loading}
                className="rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : editingProductId
                  ? "Update Product"
                  : "Create Product"}
              </button>

              {editingProductId && (
                <button
                  onClick={resetForm}
                  className="rounded-2xl border border-slate-200 px-6 py-3 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-purple-600">
              Quick insights
            </p>
            <h2 className="mt-2 text-2xl font-bold">Catalog health</h2>

            <div className="mt-6 space-y-3">
              <MiniRow label="Active products" value={activeProducts} />
              <MiniRow label="Draft products" value={draftProducts} />
              <MiniRow label="Archived products" value={archivedProducts} />
              <MiniRow label="Total variants" value={totalVariants} />
              <MiniRow label="Low stock products" value={lowStockCount} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Storefront
            </p>
            <h2 className="mt-2 text-2xl font-bold">Preview products</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Open your public store to confirm how products appear to
              customers.
            </p>

            <a
              href={tenant ? `/store/${tenant.slug}` : "/"}
              className="mt-5 block rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open storefront
            </a>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Filters
            </p>
            <h2 className="mt-2 text-2xl font-bold">Find products quickly</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search, filter by category, status, or show only low-stock items.
            </p>
          </div>

          <button
            onClick={resetFilters}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Reset filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products..."
            className="field-input"
          />

          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="field-input"
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
            className="field-input"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            <span className="text-sm font-medium">Low stock only</span>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Products
            </p>
            <h2 className="mt-2 text-2xl font-bold">Your products</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredProducts.length} product(s) match your current filters.
            </p>
          </div>
        </div>

        {fetching ? (
          <EmptyState text="Loading products..." />
        ) : filteredProducts.length === 0 ? (
          <EmptyState text="No products found." />
        ) : (
          <div className="space-y-5">
            {filteredProducts.map((product) => {
              const category = getProductCategory(product);
              const variants = getProductVariants(product);
              const { reviewCount, averageRating } = getReviewStats(product);
              const lowestPrice = getLowestProductPrice(product);

              return (
                <div
                  key={product.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-100 sm:w-28">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">
                            No image
                          </span>
                        )}
                      </div>

                      <div className="max-w-2xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(
                              product.status
                            )}`}
                          >
                            {product.status}
                          </span>

                          {category && (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                              {category.name}
                            </span>
                          )}

                          {isLowStock(product) && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                              Low stock
                            </span>
                          )}

                          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                            {variants.length} variant(s)
                          </span>

                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                            ⭐{" "}
                            {reviewCount > 0
                              ? `${averageRating.toFixed(1)} (${reviewCount})`
                              : "No reviews"}
                          </span>
                        </div>

                        <h3 className="mt-3 text-xl font-bold text-slate-950">
                          {product.name}
                        </h3>

                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                          {product.description || "No description"}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                          <MiniMetric
                            label="Price"
                            value={money(currency, lowestPrice)}
                          />
                          <MiniMetric
                            label="Base stock"
                            value={product.inventory}
                          />
                          <MiniMetric
                            label="Threshold"
                            value={product.low_stock_threshold || 5}
                          />
                          <MiniMetric
                            label="Created"
                            value={new Date(
                              product.created_at
                            ).toLocaleDateString()}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {tenant && (
                        <a
                          href={`/store/${tenant.slug}/products/${product.id}`}
                          target="_blank"
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                        >
                          Preview
                        </a>
                      )}

                      <button
                        onClick={() =>
                          setExpandedProductId(
                            expandedProductId === product.id
                              ? null
                              : product.id
                          )
                        }
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                      >
                        {expandedProductId === product.id
                          ? "Hide variants"
                          : "Manage variants"}
                      </button>

                      <button
                        onClick={() => handleEditClick(product)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {expandedProductId === product.id && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-5">
                      <VariantManager
                        tenantId={tenantId}
                        variantName={variantName}
                        setVariantName={setVariantName}
                        variantSku={variantSku}
                        setVariantSku={setVariantSku}
                        variantOptionName={variantOptionName}
                        setVariantOptionName={setVariantOptionName}
                        variantOptionValue={variantOptionValue}
                        setVariantOptionValue={setVariantOptionValue}
                        variantPriceAdjustment={variantPriceAdjustment}
                        setVariantPriceAdjustment={setVariantPriceAdjustment}
                        variantInventory={variantInventory}
                        setVariantInventory={setVariantInventory}
                        variantLowStockThreshold={variantLowStockThreshold}
                        setVariantLowStockThreshold={
                          setVariantLowStockThreshold
                        }
                        variantStatus={variantStatus}
                        setVariantStatus={setVariantStatus}
                        variantImageUrl={variantImageUrl}
                        setVariantImageUrl={setVariantImageUrl}
                        editingVariantId={editingVariantId}
                        variantLoading={variantLoading}
                        handleCreateVariant={handleCreateVariant}
                        handleUpdateVariant={handleUpdateVariant}
                        resetVariantForm={resetVariantForm}
                      />

                      {variants.length === 0 ? (
                        <p className="mt-5 text-sm text-slate-500">
                          No variants yet.
                        </p>
                      ) : (
                        <div className="mt-5 space-y-3">
                          {variants.map((variant) => (
                            <div
                              key={variant.id}
                              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                                  {variant.image_url ? (
                                    <img
                                      src={variant.image_url}
                                      alt={variant.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs text-slate-400">
                                      No Image
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <h4 className="font-semibold text-slate-950">
                                    {variant.name}
                                  </h4>

                                  <p className="text-sm text-slate-500">
                                    {variant.option_name}:{" "}
                                    {variant.option_value}
                                  </p>

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span
                                      className={`rounded-full px-2 py-1 text-xs capitalize ${statusClass(
                                        variant.status
                                      )}`}
                                    >
                                      {variant.status}
                                    </span>

                                    {variant.sku && (
                                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                                        SKU: {variant.sku}
                                      </span>
                                    )}

                                    {isVariantLowStock(variant) && (
                                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                                        Low stock
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-left md:text-right">
                                <p className="font-bold text-slate-950">
                                  Adjustment:{" "}
                                  {money(
                                    currency,
                                    Number(variant.price_adjustment || 0)
                                  )}
                                </p>

                                <p className="text-sm text-slate-500">
                                  Stock: {variant.inventory}
                                </p>

                                <div className="mt-3 flex gap-2 md:justify-end">
                                  <button
                                    onClick={() =>
                                      handleEditVariantClick(variant)
                                    }
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    onClick={() =>
                                      handleDeleteVariant(variant.id)
                                    }
                                    className="rounded-xl bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
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
      </section>
    </div>
  );
}

function VariantManager({
  tenantId,
  variantName,
  setVariantName,
  variantSku,
  setVariantSku,
  variantOptionName,
  setVariantOptionName,
  variantOptionValue,
  setVariantOptionValue,
  variantPriceAdjustment,
  setVariantPriceAdjustment,
  variantInventory,
  setVariantInventory,
  variantLowStockThreshold,
  setVariantLowStockThreshold,
  variantStatus,
  setVariantStatus,
  variantImageUrl,
  setVariantImageUrl,
  editingVariantId,
  variantLoading,
  handleCreateVariant,
  handleUpdateVariant,
  resetVariantForm,
}: {
  tenantId: string | null;
  variantName: string;
  setVariantName: (value: string) => void;
  variantSku: string;
  setVariantSku: (value: string) => void;
  variantOptionName: string;
  setVariantOptionName: (value: string) => void;
  variantOptionValue: string;
  setVariantOptionValue: (value: string) => void;
  variantPriceAdjustment: string;
  setVariantPriceAdjustment: (value: string) => void;
  variantInventory: string;
  setVariantInventory: (value: string) => void;
  variantLowStockThreshold: string;
  setVariantLowStockThreshold: (value: string) => void;
  variantStatus: string;
  setVariantStatus: (value: string) => void;
  variantImageUrl: string;
  setVariantImageUrl: (value: string) => void;
  editingVariantId: string | null;
  variantLoading: boolean;
  handleCreateVariant: () => void;
  handleUpdateVariant: () => void;
  resetVariantForm: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-xl font-bold text-slate-950">
        {editingVariantId ? "Edit variant" : "Create variant"}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        Add sizes, colors, SKUs, stock levels, image overrides, and price
        adjustments.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <InputField
          label="Variant name"
          value={variantName}
          onChange={setVariantName}
          placeholder="Black / Large"
        />

        <InputField
          label="SKU"
          value={variantSku}
          onChange={setVariantSku}
          placeholder="Optional"
        />

        <InputField
          label="Option name"
          value={variantOptionName}
          onChange={setVariantOptionName}
          placeholder="Size"
        />

        <InputField
          label="Option value"
          value={variantOptionValue}
          onChange={setVariantOptionValue}
          placeholder="XL"
        />

        <InputField
          label="Price adjustment"
          type="number"
          value={variantPriceAdjustment}
          onChange={setVariantPriceAdjustment}
          placeholder="0.00"
        />

        <InputField
          label="Variant inventory"
          type="number"
          value={variantInventory}
          onChange={setVariantInventory}
          placeholder="0"
        />

        <InputField
          label="Low stock threshold"
          type="number"
          value={variantLowStockThreshold}
          onChange={setVariantLowStockThreshold}
          placeholder="5"
        />

        <SelectField
          label="Status"
          value={variantStatus}
          onChange={setVariantStatus}
          options={[
            { label: "Active", value: "active" },
            { label: "Draft", value: "draft" },
            { label: "Archived", value: "archived" },
          ]}
        />
      </div>

      <div className="mt-5">
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
            className="mt-4 h-28 w-28 rounded-xl border object-cover"
          />
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={editingVariantId ? handleUpdateVariant : handleCreateVariant}
          disabled={variantLoading}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
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
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Cancel Edit
          </button>
        )}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-input"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-input min-h-[130px]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: {
    value: string;
    label: string;
  }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatCard({
  label,
  value,
  helper,
  danger,
}: {
  label: string;
  value: string | number;
  helper: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-6 shadow-sm ${
        danger
          ? "border-red-200 bg-red-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className={danger ? "text-sm text-red-600" : "text-sm text-slate-500"}>
        {label}
      </p>
      <h2
        className={`mt-3 text-3xl font-bold tracking-tight ${
          danger ? "text-red-700" : "text-slate-950"
        }`}
      >
        {value}
      </h2>
      <p className={danger ? "mt-2 text-sm text-red-500" : "mt-2 text-sm text-slate-400"}>
        {helper}
      </p>
    </div>
  );
}

function HeroMiniRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function MiniRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="font-bold text-slate-950">{value}</span>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-10 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}