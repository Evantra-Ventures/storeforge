"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Coupon = {
  id: string;
  tenant_id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  minimum_order_amount: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  status: "active" | "inactive";
  created_at: string;
};

export default function CouponsPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">(
    "percentage"
  );
  const [discountValue, setDiscountValue] = useState("");
  const [minimumOrderAmount, setMinimumOrderAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMinimumOrderAmount("");
    setUsageLimit("");
    setExpiresAt("");
    setStatus("active");
  };

  const fetchCoupons = async () => {
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
        .from("coupons")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        alert(error.message);
        return;
      }

      setCoupons(data || []);
    } catch (error) {
      console.error(error);
      alert("Failed to fetch coupons.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;

    if (!code.trim() || !discountValue) {
      alert("Coupon code and discount value are required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        tenant_id: tenantId,
        code: code.trim().toUpperCase(),
        description: description || null,
        discount_type: discountType,
        discount_value: Number(discountValue),
        minimum_order_amount: Number(minimumOrderAmount || 0),
        usage_limit: usageLimit ? Number(usageLimit) : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        status,
      };

      if (editingId) {
        const { error } = await supabase
          .from("coupons")
          .update(payload)
          .eq("id", editingId)
          .eq("tenant_id", tenantId);

        if (error) {
          alert(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("coupons").insert(payload);

        if (error) {
          alert(error.message);
          return;
        }
      }

      resetForm();
      fetchCoupons();
    } catch (error) {
      console.error(error);
      alert("Failed to save coupon.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setCode(coupon.code);
    setDescription(coupon.description || "");
    setDiscountType(coupon.discount_type);
    setDiscountValue(coupon.discount_value.toString());
    setMinimumOrderAmount((coupon.minimum_order_amount || 0).toString());
    setUsageLimit(coupon.usage_limit?.toString() || "");
    setExpiresAt(
      coupon.expires_at
        ? new Date(coupon.expires_at).toISOString().slice(0, 16)
        : ""
    );
    setStatus(coupon.status);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (couponId: string) => {
    if (!tenantId) return;

    const confirmed = confirm("Delete this coupon?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", couponId)
      .eq("tenant_id", tenantId);

    if (error) {
      alert(error.message);
      return;
    }

    fetchCoupons();
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Coupons</h1>
        <p className="text-slate-500 mt-2">
          Create and manage discounts for your storefront.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">
            {editingId ? "Edit Coupon" : "Create Coupon"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Coupons can be applied during checkout.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SAVE20"
            className="border rounded-xl p-3"
          />

          <select
            value={discountType}
            onChange={(e) =>
              setDiscountType(e.target.value as "percentage" | "fixed")
            }
            className="border rounded-xl p-3"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
          </select>

          <input
            type="number"
            min="0"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === "percentage" ? "20" : "50"}
            className="border rounded-xl p-3"
          />

          <input
            type="number"
            min="0"
            value={minimumOrderAmount}
            onChange={(e) => setMinimumOrderAmount(e.target.value)}
            placeholder="Minimum order amount"
            className="border rounded-xl p-3"
          />

          <input
            type="number"
            min="0"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="Usage limit"
            className="border rounded-xl p-3"
          />

          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="border rounded-xl p-3"
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            className="border rounded-xl p-3"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="border rounded-xl p-3"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
          </button>

          {editingId && (
            <button
              onClick={resetForm}
              className="border px-6 py-3 rounded-xl font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Your Coupons</h2>
          <span className="text-sm text-slate-500">
            {coupons.length} coupon(s)
          </span>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading coupons...</p>
        ) : coupons.length === 0 ? (
          <p className="text-slate-500 text-center py-12">
            No coupons created yet.
          </p>
        ) : (
          <div className="space-y-4">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-lg">{coupon.code}</h3>
                    <span className="bg-slate-100 px-2 py-1 rounded-md text-xs capitalize">
                      {coupon.status}
                    </span>
                  </div>

                  <p className="text-sm text-slate-500 mt-2">
                    {coupon.discount_type === "percentage"
                      ? `${coupon.discount_value}% off`
                      : `GHS ${Number(coupon.discount_value).toFixed(2)} off`}
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Used {coupon.used_count}
                    {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""} times
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(coupon)}
                    className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-100"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(coupon.id)}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}