"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ShippingZone = {
  id: string;
  tenant_id: string;
  name: string;
  region: string | null;
  city: string | null;
  area: string | null;
  fee: number;
  estimated_days: string | null;
  status: "active" | "inactive";
  created_at: string;
};

export default function ShippingPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [fee, setFee] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setRegion("");
    setCity("");
    setArea("");
    setFee("");
    setEstimatedDays("");
    setStatus("active");
  };

  const fetchZones = async () => {
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
        .from("shipping_zones")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        alert(error.message);
        return;
      }

      setZones(data || []);
    } catch (error) {
      console.error(error);
      alert("Failed to fetch shipping zones.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;

    if (!name.trim() || !fee) {
      alert("Zone name and delivery fee are required.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        tenant_id: tenantId,
        name,
        region: region || null,
        city: city || null,
        area: area || null,
        fee: Number(fee),
        estimated_days: estimatedDays || null,
        status,
      };

      if (editingId) {
        const { error } = await supabase
          .from("shipping_zones")
          .update(payload)
          .eq("id", editingId)
          .eq("tenant_id", tenantId);

        if (error) {
          alert(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("shipping_zones").insert(payload);

        if (error) {
          alert(error.message);
          return;
        }
      }

      resetForm();
      fetchZones();
    } catch (error) {
      console.error(error);
      alert("Failed to save shipping zone.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (zone: ShippingZone) => {
    setEditingId(zone.id);
    setName(zone.name);
    setRegion(zone.region || "");
    setCity(zone.city || "");
    setArea(zone.area || "");
    setFee(zone.fee.toString());
    setEstimatedDays(zone.estimated_days || "");
    setStatus(zone.status);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (zoneId: string) => {
    if (!tenantId) return;

    const confirmed = confirm("Delete this shipping zone?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("shipping_zones")
      .delete()
      .eq("id", zoneId)
      .eq("tenant_id", tenantId);

    if (error) {
      alert(error.message);
      return;
    }

    fetchZones();
  };

  useEffect(() => {
    fetchZones();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Shipping Zones</h1>
        <p className="text-slate-500 mt-2">
          Set delivery locations and fees for your store.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">
            {editingId ? "Edit Shipping Zone" : "Create Shipping Zone"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Each zone belongs only to your store.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Accra Central"
            className="border rounded-xl p-3"
          />

          <input
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="Delivery fee"
            className="border rounded-xl p-3"
          />

          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Greater Accra"
            className="border rounded-xl p-3"
          />

          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Accra"
            className="border rounded-xl p-3"
          />

          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Osu / East Legon / Tema"
            className="border rounded-xl p-3"
          />

          <input
            value={estimatedDays}
            onChange={(e) => setEstimatedDays(e.target.value)}
            placeholder="1-3 days"
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
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Update Zone"
                : "Create Zone"}
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
          <h2 className="text-xl font-semibold">Your Shipping Zones</h2>
          <span className="text-sm text-slate-500">
            {zones.length} zone(s)
          </span>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading shipping zones...</p>
        ) : zones.length === 0 ? (
          <p className="text-slate-500 text-center py-12">
            No shipping zones created yet.
          </p>
        ) : (
          <div className="space-y-4">
            {zones.map((zone) => (
              <div
                key={zone.id}
                className="border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-lg">{zone.name}</h3>

                    <span className="bg-slate-100 px-2 py-1 rounded-md text-xs capitalize">
                      {zone.status}
                    </span>
                  </div>

                  <p className="text-sm text-slate-500 mt-2">
                    {[zone.area, zone.city, zone.region]
                      .filter(Boolean)
                      .join(", ") || "No location details"}
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Estimated delivery: {zone.estimated_days || "Not set"}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <p className="text-xl font-bold">
                    GHS {Number(zone.fee).toFixed(2)}
                  </p>

                  <button
                    onClick={() => handleEdit(zone)}
                    className="px-4 py-2 rounded-lg border text-sm hover:bg-slate-100"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => handleDelete(zone.id)}
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