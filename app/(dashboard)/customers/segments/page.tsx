"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SegmentSummary = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "manual" | "automatic";
  rules: Record<string, any>;
  color: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
  member_count: number;
};

type SegmentMember = {
  id: string;
  tenant_id: string;
  segment_id: string;
  customer_profile_id: string;
  user_id: string;
  source: string;
  created_at: string;
  customer:
    | {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        total_orders: number;
        total_spent: number;
        last_order_at: string | null;
        status: string;
      }
    | {
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        total_orders: number;
        total_spent: number;
        last_order_at: string | null;
        status: string;
      }[]
    | null;
};

type CustomerProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  total_orders: number;
  total_spent: number;
  status: string;
};

export default function CustomerSegmentsPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [members, setMembers] = useState<SegmentMember[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshingSegments, setRefreshingSegments] = useState(false);
  const [creatingSegment, setCreatingSegment] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [updatingSegmentId, setUpdatingSegmentId] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const money = (value: number) => `GHS ${Number(value || 0).toFixed(2)}`;

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const getCustomer = (member: SegmentMember) => {
    if (!member.customer) return null;
    return Array.isArray(member.customer)
      ? member.customer[0]
      : member.customer;
  };

  const selectedSegment = useMemo(() => {
    return (
      segments.find((segment) => segment.id === selectedSegmentId) || null
    );
  }, [segments, selectedSegmentId]);

  const filteredSegments = useMemo(() => {
    return segments.filter((segment) => {
      const matchesSearch =
        !searchTerm ||
        [segment.name, segment.description, segment.slug]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesType = !typeFilter || segment.type === typeFilter;
      const matchesStatus = !statusFilter || segment.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [segments, searchTerm, typeFilter, statusFilter]);

  const selectedSegmentMembers = useMemo(() => {
    if (!selectedSegmentId) return [];

    return members.filter((member) => member.segment_id === selectedSegmentId);
  }, [members, selectedSegmentId]);

  const availableCustomersForManualSegment = useMemo(() => {
    if (!selectedSegment || selectedSegment.type !== "manual") return [];

    const existingIds = new Set(
      selectedSegmentMembers.map((member) => member.customer_profile_id)
    );

    return customers.filter((customer) => !existingIds.has(customer.id));
  }, [customers, selectedSegment, selectedSegmentMembers]);

  const stats = useMemo(() => {
    return {
      totalSegments: segments.length,
      automaticSegments: segments.filter(
        (segment) => segment.type === "automatic"
      ).length,
      manualSegments: segments.filter((segment) => segment.type === "manual")
        .length,
      totalMembers: segments.reduce(
        (acc, segment) => acc + Number(segment.member_count || 0),
        0
      ),
    };
  }, [segments]);

  const getSegmentTone = (segment: SegmentSummary) => {
    if (segment.status === "inactive") return "bg-slate-100 text-slate-600";

    switch (segment.color) {
      case "purple":
        return "bg-purple-100 text-purple-700";
      case "green":
        return "bg-green-100 text-green-700";
      case "orange":
        return "bg-orange-100 text-orange-700";
      case "yellow":
        return "bg-yellow-100 text-yellow-700";
      case "indigo":
        return "bg-indigo-100 text-indigo-700";
      case "red":
        return "bg-red-100 text-red-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const fetchSegments = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setErrorMessage("Tenant profile not found.");
        return;
      }

      setTenantId(profile.tenant_id);

      await supabase.rpc("create_default_customer_segments", {
        p_tenant_id: profile.tenant_id,
      });

      const { data: segmentsData, error: segmentsError } = await supabase
        .from("customer_segment_summary")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: true });

      if (segmentsError) {
        setErrorMessage(segmentsError.message);
        return;
      }

      setSegments(segmentsData || []);

      if (!selectedSegmentId && segmentsData && segmentsData.length > 0) {
        setSelectedSegmentId(segmentsData[0].id);
      }

      const { data: customersData, error: customersError } = await supabase
        .from("customer_profiles")
        .select(`
          id,
          user_id,
          full_name,
          email,
          phone,
          total_orders,
          total_spent,
          status
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (customersError) {
        setErrorMessage(customersError.message);
        return;
      }

      setCustomers(customersData || []);

      const { data: membersData, error: membersError } = await supabase
        .from("customer_segment_members")
        .select(`
          id,
          tenant_id,
          segment_id,
          customer_profile_id,
          user_id,
          source,
          created_at,
          customer:customer_profiles (
            id,
            full_name,
            email,
            phone,
            total_orders,
            total_spent,
            last_order_at,
            status
          )
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (membersError) {
        setErrorMessage(membersError.message);
        return;
      }

      setMembers(membersData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load customer segments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshAutomaticSegments = async () => {
    if (!tenantId) return;

    try {
      setRefreshingSegments(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase.rpc("refresh_customer_segments", {
        p_tenant_id: tenantId,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Automatic customer segments refreshed.");
      fetchSegments();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to refresh customer segments.");
    } finally {
      setRefreshingSegments(false);
    }
  };

  const handleCreateManualSegment = async () => {
    if (!tenantId) return;

    try {
      setCreatingSegment(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!name.trim()) {
        setErrorMessage("Segment name is required.");
        return;
      }

      const segmentSlug = slugify(name);

      if (!segmentSlug) {
        setErrorMessage("Enter a valid segment name.");
        return;
      }

      const { data, error } = await supabase
        .from("customer_segments")
        .insert({
          tenant_id: tenantId,
          name,
          slug: segmentSlug,
          description: description || null,
          type: "manual",
          rules: {},
          color,
          status: "active",
        })
        .select("id")
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setName("");
      setDescription("");
      setColor("blue");
      setSelectedSegmentId(data.id);
      setSuccessMessage("Manual customer segment created.");
      fetchSegments();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to create segment.");
    } finally {
      setCreatingSegment(false);
    }
  };

  const handleAddCustomerToSegment = async () => {
    if (!tenantId || !userId || !selectedSegment || !selectedCustomerId) return;

    try {
      setAddingMember(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (selectedSegment.type !== "manual") {
        setErrorMessage("Customers can only be manually added to manual segments.");
        return;
      }

      const customer = customers.find(
        (item) => item.id === selectedCustomerId
      );

      if (!customer) {
        setErrorMessage("Customer not found.");
        return;
      }

      const { error } = await supabase
        .from("customer_segment_members")
        .insert({
          tenant_id: tenantId,
          segment_id: selectedSegment.id,
          customer_profile_id: customer.id,
          user_id: customer.user_id,
          added_by: userId,
          source: "manual",
        });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSelectedCustomerId("");
      setSuccessMessage("Customer added to segment.");
      fetchSegments();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to add customer to segment.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (member: SegmentMember) => {
    if (!selectedSegment) return;

    if (selectedSegment.type !== "manual") {
      setErrorMessage(
        "Automatic segment members are controlled by refresh rules."
      );
      return;
    }

    const confirmed = confirm("Remove this customer from the segment?");
    if (!confirmed) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("customer_segment_members")
        .delete()
        .eq("id", member.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Customer removed from segment.");
      fetchSegments();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to remove customer from segment.");
    }
  };

  const handleToggleSegmentStatus = async (segment: SegmentSummary) => {
    if (!tenantId) return;

    try {
      setUpdatingSegmentId(segment.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = segment.status === "active" ? "inactive" : "active";

      const { error } = await supabase
        .from("customer_segments")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", segment.id)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(`Segment marked as ${nextStatus}.`);
      fetchSegments();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update segment.");
    } finally {
      setUpdatingSegmentId(null);
    }
  };

  const handleDeleteManualSegment = async (segment: SegmentSummary) => {
    if (!tenantId) return;

    if (segment.type !== "manual") {
      setErrorMessage("Only manual segments can be deleted.");
      return;
    }

    const confirmed = confirm(
      `Delete "${segment.name}"? This will remove the segment and its members.`
    );

    if (!confirmed) return;

    try {
      setUpdatingSegmentId(segment.id);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("customer_segments")
        .delete()
        .eq("id", segment.id)
        .eq("tenant_id", tenantId)
        .eq("type", "manual");

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Manual segment deleted.");
      setSelectedSegmentId(null);
      fetchSegments();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to delete segment.");
    } finally {
      setUpdatingSegmentId(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setTypeFilter("");
    setStatusFilter("");
  };

  if (loading) {
    return <p className="text-slate-500">Loading customer segments...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <a
            href="/customers"
            className="text-sm text-slate-500 hover:text-black"
          >
            ← Back to Customers
          </a>

          <h1 className="text-3xl font-bold mt-4">Customer Segments</h1>
          <p className="text-slate-500 mt-2">
            Group customers into automatic and manual audiences for retention,
            loyalty, and marketing.
          </p>
        </div>

        <button
          onClick={handleRefreshAutomaticSegments}
          disabled={refreshingSegments}
          className="bg-black text-white px-5 py-3 rounded-xl text-sm disabled:opacity-50"
        >
          {refreshingSegments ? "Refreshing..." : "Refresh Automatic Segments"}
        </button>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Segments" value={stats.totalSegments} />
        <StatCard label="Automatic" value={stats.automaticSegments} />
        <StatCard label="Manual" value={stats.manualSegments} />
        <StatCard label="Total Memberships" value={stats.totalMembers} />
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Create Manual Segment</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manual segments are useful for custom audiences like “Wholesale
            buyers”, “Friends and family”, or “Campus customers”.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Segment name"
            className="border rounded-xl p-3"
          />

          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description optional"
            className="border rounded-xl p-3 md:col-span-2"
          />

          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="blue">Blue</option>
            <option value="purple">Purple</option>
            <option value="green">Green</option>
            <option value="orange">Orange</option>
            <option value="yellow">Yellow</option>
            <option value="indigo">Indigo</option>
            <option value="red">Red</option>
          </select>
        </div>

        <button
          onClick={handleCreateManualSegment}
          disabled={creatingSegment}
          className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
        >
          {creatingSegment ? "Creating..." : "Create Segment"}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Filter Segments</h2>
            <p className="text-sm text-slate-500 mt-1">
              Showing {filteredSegments.length} of {segments.length} segment(s)
            </p>
          </div>

          <button
            onClick={resetFilters}
            className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search segments..."
            className="border rounded-xl p-3"
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All types</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white rounded-2xl shadow p-6 lg:col-span-1">
          <h2 className="text-xl font-semibold mb-6">Segments</h2>

          {filteredSegments.length === 0 ? (
            <p className="text-slate-500">No segments found.</p>
          ) : (
            <div className="space-y-3">
              {filteredSegments.map((segment) => (
                <button
                  key={segment.id}
                  onClick={() => setSelectedSegmentId(segment.id)}
                  className={`w-full text-left border rounded-2xl p-4 transition ${
                    selectedSegmentId === segment.id
                      ? "border-black bg-slate-50"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{segment.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {segment.member_count} member(s)
                      </p>
                    </div>

                    <span
                      className={`px-2 py-1 rounded-full text-xs capitalize ${getSegmentTone(
                        segment
                      )}`}
                    >
                      {segment.type}
                    </span>
                  </div>

                  {segment.description && (
                    <p className="text-xs text-slate-500 mt-3">
                      {segment.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-6 lg:col-span-2">
          {!selectedSegment ? (
            <div className="text-center py-16 text-slate-500">
              Select a segment to view members.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs capitalize ${getSegmentTone(
                        selectedSegment
                      )}`}
                    >
                      {selectedSegment.type}
                    </span>

                    <span
                      className={`px-3 py-1 rounded-full text-xs capitalize ${
                        selectedSegment.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {selectedSegment.status}
                    </span>
                  </div>

                  <h2 className="text-2xl font-bold mt-3">
                    {selectedSegment.name}
                  </h2>

                  <p className="text-sm text-slate-500 mt-2">
                    {selectedSegment.description || "No description"}
                  </p>

                  <p className="text-xs text-slate-400 mt-2">
                    Slug: {selectedSegment.slug}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button
                    onClick={() => handleToggleSegmentStatus(selectedSegment)}
                    disabled={updatingSegmentId === selectedSegment.id}
                    className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100 disabled:opacity-50"
                  >
                    {selectedSegment.status === "active"
                      ? "Deactivate"
                      : "Activate"}
                  </button>

                  {selectedSegment.type === "manual" && (
                    <button
                      onClick={() => handleDeleteManualSegment(selectedSegment)}
                      disabled={updatingSegmentId === selectedSegment.id}
                      className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-600 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {selectedSegment.type === "automatic" && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl p-5">
                  <p className="font-semibold">Automatic Segment</p>
                  <p className="text-sm mt-1">
                    This segment is managed by rules. Click “Refresh Automatic
                    Segments” to update membership based on latest customer data.
                  </p>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm">
                      View rules
                    </summary>

                    <pre className="bg-blue-950 text-blue-50 rounded-xl p-4 text-xs overflow-auto mt-3">
                      {JSON.stringify(selectedSegment.rules || {}, null, 2)}
                    </pre>
                  </details>
                </div>
              )}

              {selectedSegment.type === "manual" && (
                <div className="bg-slate-50 border rounded-2xl p-5 space-y-4">
                  <div>
                    <h3 className="font-semibold">Add Customer</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Add customers manually to this custom segment.
                    </p>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3">
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="border rounded-xl p-3 flex-1 bg-white"
                    >
                      <option value="">Select customer</option>

                      {availableCustomersForManualSegment.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.full_name || "Unnamed Customer"} —{" "}
                          {customer.email || customer.phone || "No contact"} —{" "}
                          {money(Number(customer.total_spent || 0))}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleAddCustomerToSegment}
                      disabled={addingMember || !selectedCustomerId}
                      className="bg-black text-white px-5 py-3 rounded-xl text-sm disabled:opacity-50"
                    >
                      {addingMember ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-semibold">Members</h3>
                  <span className="text-sm text-slate-500">
                    {selectedSegmentMembers.length} member(s)
                  </span>
                </div>

                {selectedSegmentMembers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 border rounded-2xl">
                    No customers in this segment yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedSegmentMembers.map((member) => {
                      const customer = getCustomer(member);

                      return (
                        <div
                          key={member.id}
                          className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">
                                {member.source}
                              </span>

                              <span
                                className={`px-3 py-1 rounded-full text-xs capitalize ${
                                  customer?.status === "active"
                                    ? "bg-green-100 text-green-700"
                                    : customer?.status === "blocked"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {customer?.status || "unknown"}
                              </span>
                            </div>

                            <h4 className="font-semibold mt-3">
                              {customer?.full_name || "Unnamed Customer"}
                            </h4>

                            <p className="text-sm text-slate-500 mt-1">
                              {customer?.email ||
                                customer?.phone ||
                                "No contact"}
                            </p>

                            <p className="text-xs text-slate-400 mt-1">
                              Added{" "}
                              {new Date(member.created_at).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="md:text-right">
                            <p className="font-bold">
                              {money(Number(customer?.total_spent || 0))}
                            </p>

                            <p className="text-sm text-slate-500 mt-1">
                              {customer?.total_orders || 0} order(s)
                            </p>

                            <div className="flex gap-2 mt-3 md:justify-end">
                              {customer && (
                                <a
                                  href={`/customers/${customer.id}`}
                                  className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
                                >
                                  View
                                </a>
                              )}

                              {selectedSegment.type === "manual" && (
                                <button
                                  onClick={() => handleRemoveMember(member)}
                                  className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-600"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="text-3xl font-bold mt-2">{value}</h2>
    </div>
  );
}