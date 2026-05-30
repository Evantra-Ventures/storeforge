"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CustomerSummary = {
  id: string;
  tenant_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  marketing_email_opt_in: boolean;
  marketing_sms_opt_in: boolean;
  marketing_whatsapp_opt_in: boolean;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  default_address_id: string | null;
  default_address_label: string | null;
  default_address_line1: string | null;
  default_area: string | null;
  default_city: string | null;
  default_region: string | null;
  default_country: string | null;
};

export default function CustomersPage() {
  const supabase = createClient();

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [marketingFilter, setMarketingFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const money = (value: number) => `GHS ${Number(value || 0).toFixed(2)}`;

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage("You must be logged in.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setErrorMessage("Tenant profile not found.");
        return;
      }

      const { data, error } = await supabase
        .from("customer_profile_summary")
        .select("*")
        .eq("tenant_id", profile.tenant_id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setCustomers(data || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();

      result = result.filter((customer) =>
        [
          customer.full_name,
          customer.email,
          customer.phone,
          customer.default_address_line1,
          customer.default_area,
          customer.default_city,
          customer.default_region,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    if (statusFilter) {
      result = result.filter((customer) => customer.status === statusFilter);
    }

    if (marketingFilter) {
      result = result.filter((customer) => {
        if (marketingFilter === "email") return customer.marketing_email_opt_in;
        if (marketingFilter === "sms") return customer.marketing_sms_opt_in;
        if (marketingFilter === "whatsapp")
          return customer.marketing_whatsapp_opt_in;
        if (marketingFilter === "none") {
          return (
            !customer.marketing_email_opt_in &&
            !customer.marketing_sms_opt_in &&
            !customer.marketing_whatsapp_opt_in
          );
        }

        return true;
      });
    }

    result.sort((a, b) => {
      if (sortBy === "spent") {
        return Number(b.total_spent || 0) - Number(a.total_spent || 0);
      }

      if (sortBy === "orders") {
        return Number(b.total_orders || 0) - Number(a.total_orders || 0);
      }

      if (sortBy === "last_order") {
        return (
          new Date(b.last_order_at || 0).getTime() -
          new Date(a.last_order_at || 0).getTime()
        );
      }

      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

    return result;
  }, [customers, searchTerm, statusFilter, marketingFilter, sortBy]);

  const stats = useMemo(() => {
    const totalSpent = customers.reduce(
      (acc, customer) => acc + Number(customer.total_spent || 0),
      0
    );

    const totalOrders = customers.reduce(
      (acc, customer) => acc + Number(customer.total_orders || 0),
      0
    );

    const emailOptIns = customers.filter(
      (customer) => customer.marketing_email_opt_in
    ).length;

    const smsOptIns = customers.filter(
      (customer) => customer.marketing_sms_opt_in
    ).length;

    const whatsappOptIns = customers.filter(
      (customer) => customer.marketing_whatsapp_opt_in
    ).length;

    return {
      totalCustomers: customers.length,
      totalSpent,
      totalOrders,
      averageCustomerValue:
        customers.length > 0 ? totalSpent / customers.length : 0,
      emailOptIns,
      smsOptIns,
      whatsappOptIns,
      repeatCustomers: customers.filter(
        (customer) => Number(customer.total_orders || 0) > 1
      ).length,
    };
  }, [customers]);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setMarketingFilter("");
    setSortBy("recent");
  };

  if (loading) {
    return <p className="text-slate-500">Loading customers...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-slate-500 mt-2">
            View customer profiles, order history, saved address summary, and
            marketing preferences.
          </p>
        </div>

        <button
          onClick={fetchCustomers}
          className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {errorMessage && (
        <div className="bg-red-100 text-red-700 p-4 rounded-xl">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Customers" value={stats.totalCustomers} />
        <StatCard label="Repeat Customers" value={stats.repeatCustomers} />
        <StatCard label="Total Customer Spend" value={money(stats.totalSpent)} />
        <StatCard
          label="Avg. Customer Value"
          value={money(stats.averageCustomerValue)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Customer Orders" value={stats.totalOrders} />
        <StatCard label="Email Opt-ins" value={stats.emailOptIns} />
        <StatCard label="SMS Opt-ins" value={stats.smsOptIns} />
        <StatCard label="WhatsApp Opt-ins" value={stats.whatsappOptIns} />
      </div>

      <div className="bg-white rounded-2xl shadow p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Filter Customers</h2>
            <p className="text-sm text-slate-500 mt-1">
              Showing {filteredCustomers.length} of {customers.length} customer(s)
            </p>
          </div>

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
            placeholder="Search name, email, phone, city..."
            className="border rounded-xl p-3"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={marketingFilter}
            onChange={(e) => setMarketingFilter(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="">All marketing</option>
            <option value="email">Email opt-in</option>
            <option value="sms">SMS opt-in</option>
            <option value="whatsapp">WhatsApp opt-in</option>
            <option value="none">No opt-in</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="recent">Newest customers</option>
            <option value="spent">Highest spend</option>
            <option value="orders">Most orders</option>
            <option value="last_order">Recent order</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold mb-6">Customer List</h2>

        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No customers found.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs capitalize ${
                        customer.status === "active"
                          ? "bg-green-100 text-green-700"
                          : customer.status === "blocked"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {customer.status}
                    </span>

                    {Number(customer.total_orders || 0) > 1 && (
                      <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                        Repeat Customer
                      </span>
                    )}

                    {customer.marketing_email_opt_in && (
                      <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs">
                        Email Opt-in
                      </span>
                    )}

                    {customer.marketing_sms_opt_in && (
                      <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                        SMS Opt-in
                      </span>
                    )}

                    {customer.marketing_whatsapp_opt_in && (
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs">
                        WhatsApp Opt-in
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-lg mt-3">
                    {customer.full_name || "Unnamed Customer"}
                  </h3>

                  <div className="text-sm text-slate-500 mt-2 space-y-1">
                    <p>{customer.email || "No email"}</p>
                    <p>{customer.phone || "No phone"}</p>

                    {customer.default_address_line1 && (
                      <p>
                        Address:{" "}
                        {[
                          customer.default_address_line1,
                          customer.default_area,
                          customer.default_city,
                          customer.default_region,
                          customer.default_country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}

                    <p>
                      Joined{" "}
                      {new Date(customer.created_at).toLocaleDateString()}
                    </p>

                    {customer.last_order_at && (
                      <p>
                        Last order{" "}
                        {new Date(customer.last_order_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="lg:text-right">
                  <p className="text-2xl font-bold">
                    {money(Number(customer.total_spent || 0))}
                  </p>

                  <p className="text-sm text-slate-500 mt-1">
                    {customer.total_orders || 0} order(s)
                  </p>

                  <a
                    href={`/customers/${customer.id}`}
                    className="inline-block border px-4 py-2 rounded-xl text-sm mt-4 hover:bg-slate-100"
                  >
                    View Details
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
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