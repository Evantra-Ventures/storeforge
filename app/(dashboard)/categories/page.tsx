"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  created_at: string;
};

export default function CategoriesPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const generateSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

  const resetForm = () => {
    setName("");
    setEditingId(null);
  };

  const fetchCategories = async () => {
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
        .from("categories")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId || !name.trim()) return;

    try {
      setSaving(true);

      if (editingId) {
        const { error } = await supabase
          .from("categories")
          .update({
            name,
            slug: generateSlug(name),
          })
          .eq("id", editingId)
          .eq("tenant_id", tenantId);

        if (error) {
          alert(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("categories").insert({
          tenant_id: tenantId,
          name,
          slug: generateSlug(name),
        });

        if (error) {
          alert(error.message);
          return;
        }
      }

      resetForm();
      fetchCategories();
    } catch (error) {
      console.error(error);
      alert("Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (categoryId: string) => {
    if (!tenantId) return;

    const confirmed = confirm("Delete this category?");
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId)
        .eq("tenant_id", tenantId);

      if (error) {
        alert(error.message);
        return;
      }

      fetchCategories();
    } catch (error) {
      console.error(error);
      alert("Failed to delete category.");
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Categories</h1>
        <p className="text-slate-500 mt-2">
          Organize products into storefront collections.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold">
            {editingId ? "Edit Category" : "Create Category"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Categories help customers browse your store.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Category Name
          </label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Electronics"
            className="w-full border rounded-xl p-3"
          />
        </div>

        {name && (
          <div className="bg-slate-100 rounded-xl p-4 text-sm">
            Slug: <span className="font-medium">{generateSlug(name)}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Category"
                : "Create Category"}
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
          <h2 className="text-xl font-semibold">Your Categories</h2>
          <span className="text-sm text-slate-500">
            {categories.length} category(s)
          </span>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading categories...</p>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No categories yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <div
                key={category.id}
                className="border rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div>
                  <h3 className="font-semibold text-lg">{category.name}</h3>
                  <p className="text-sm text-slate-500">{category.slug}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(category)}
                    className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-100 transition"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(category.id)}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 transition"
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