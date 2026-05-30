"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LoyaltySettings = {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  points_per_currency: number;
  currency_per_point: number;
  minimum_points_to_redeem: number;
  maximum_points_per_order: number | null;
  points_expiry_days: number | null;
  reward_name: string;
  reward_currency_label: string;
  earn_on_discounted_amount: boolean;
  earn_on_shipping: boolean;
  allow_points_redemption: boolean;
  status: string;
};

type LoyaltyReward = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  reward_type: string;
  points_cost: number;
  discount_type: string | null;
  discount_value: number | null;
  free_shipping: boolean;
  minimum_order_amount: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  created_at: string;
};

type LoyaltySummary = {
  id: string;
  customer_profile_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  points_balance: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  lifetime_points_expired: number;
  tier_name: string;
  status: string;
};

type LoyaltyTransaction = {
  id: string;
  type: string;
  status: string;
  points: number;
  points_balance_after: number;
  monetary_value: number | null;
  description: string | null;
  order_id: string | null;
  created_at: string;
};

export default function LoyaltyDashboardPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [customers, setCustomers] = useState<LoyaltySummary[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);

  const [rewardName, setRewardName] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [rewardType, setRewardType] = useState("discount");
  const [pointsCost, setPointsCost] = useState("");
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [minimumOrderAmount, setMinimumOrderAmount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingReward, setCreatingReward] = useState(false);
  const [updatingRewardId, setUpdatingRewardId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const money = (value: number) => `GHS ${Number(value || 0).toFixed(2)}`;

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const formatType = (value: string) => value.replaceAll("_", " ");

  const fetchLoyalty = async () => {
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setErrorMessage("Tenant profile not found.");
        return;
      }

      const resolvedTenantId = profile.tenant_id;
      setTenantId(resolvedTenantId);

      await supabase.rpc("ensure_loyalty_settings", {
        p_tenant_id: resolvedTenantId,
      });

      const { data: settingsData, error: settingsError } = await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("tenant_id", resolvedTenantId)
        .maybeSingle();

      if (settingsError) {
        setErrorMessage(settingsError.message);
        return;
      }

      setSettings(settingsData || null);

      const { data: rewardsData, error: rewardsError } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("tenant_id", resolvedTenantId)
        .order("created_at", { ascending: false });

      if (rewardsError) {
        setErrorMessage(rewardsError.message);
        return;
      }

      setRewards(rewardsData || []);

      const { data: customersData, error: customersError } = await supabase
        .from("customer_loyalty_summary")
        .select("*")
        .eq("tenant_id", resolvedTenantId)
        .order("points_balance", { ascending: false });

      if (customersError) {
        setErrorMessage(customersError.message);
        return;
      }

      setCustomers(customersData || []);

      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("loyalty_transactions")
          .select(`
            id,
            type,
            status,
            points,
            points_balance_after,
            monetary_value,
            description,
            order_id,
            created_at
          `)
          .eq("tenant_id", resolvedTenantId)
          .order("created_at", { ascending: false })
          .limit(30);

      if (transactionsError) {
        setErrorMessage(transactionsError.message);
        return;
      }

      setTransactions(transactionsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load loyalty dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoyalty();
  }, []);

  const stats = useMemo(() => {
    const totalPointsBalance = customers.reduce(
      (acc, customer) => acc + Number(customer.points_balance || 0),
      0
    );

    const lifetimeEarned = customers.reduce(
      (acc, customer) => acc + Number(customer.lifetime_points_earned || 0),
      0
    );

    const lifetimeRedeemed = customers.reduce(
      (acc, customer) => acc + Number(customer.lifetime_points_redeemed || 0),
      0
    );

    const lifetimeExpired = customers.reduce(
      (acc, customer) => acc + Number(customer.lifetime_points_expired || 0),
      0
    );

    const activeRewards = rewards.filter(
      (reward) => reward.status === "active"
    ).length;

    const totalRewardUsage = rewards.reduce(
      (acc, reward) => acc + Number(reward.used_count || 0),
      0
    );

    const pointsValueLiability =
      totalPointsBalance * Number(settings?.currency_per_point || 0);

    return {
      loyaltyCustomers: customers.length,
      totalPointsBalance,
      lifetimeEarned,
      lifetimeRedeemed,
      lifetimeExpired,
      activeRewards,
      totalRewards: rewards.length,
      totalRewardUsage,
      pointsValueLiability,
    };
  }, [customers, rewards, settings]);

  const topPointCustomers = useMemo(() => {
    return [...customers]
      .sort(
        (a, b) => Number(b.points_balance || 0) - Number(a.points_balance || 0)
      )
      .slice(0, 5);
  }, [customers]);

  const topEarners = useMemo(() => {
    return [...customers]
      .sort(
        (a, b) =>
          Number(b.lifetime_points_earned || 0) -
          Number(a.lifetime_points_earned || 0)
      )
      .slice(0, 5);
  }, [customers]);

  const handleSettingsChange = (field: keyof LoyaltySettings, value: any) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [field]: value,
    });
  };

  const handleSaveSettings = async () => {
    if (!tenantId || !settings) return;

    try {
      setSavingSettings(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("loyalty_settings")
        .update({
          is_enabled: settings.is_enabled,
          points_per_currency: Number(settings.points_per_currency || 0),
          currency_per_point: Number(settings.currency_per_point || 0),
          minimum_points_to_redeem: Number(
            settings.minimum_points_to_redeem || 0
          ),
          maximum_points_per_order:
            settings.maximum_points_per_order === null ||
            settings.maximum_points_per_order === undefined
              ? null
              : Number(settings.maximum_points_per_order || 0),
          points_expiry_days:
            settings.points_expiry_days === null ||
            settings.points_expiry_days === undefined
              ? null
              : Number(settings.points_expiry_days || 0),
          reward_name: settings.reward_name || "Loyalty Points",
          reward_currency_label:
            settings.reward_currency_label || "points",
          earn_on_discounted_amount: settings.earn_on_discounted_amount,
          earn_on_shipping: settings.earn_on_shipping,
          allow_points_redemption: settings.allow_points_redemption,
          status: settings.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Loyalty settings updated.");
      fetchLoyalty();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to save loyalty settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const resetRewardForm = () => {
    setRewardName("");
    setRewardDescription("");
    setRewardType("discount");
    setPointsCost("");
    setDiscountType("fixed");
    setDiscountValue("");
    setFreeShipping(false);
    setMinimumOrderAmount("");
    setUsageLimit("");
    setStartsAt("");
    setEndsAt("");
  };

  const handleCreateReward = async () => {
    if (!tenantId) return;

    try {
      setCreatingReward(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!rewardName.trim()) {
        setErrorMessage("Reward name is required.");
        return;
      }

      if (!pointsCost || Number(pointsCost) <= 0) {
        setErrorMessage("Points cost must be greater than zero.");
        return;
      }

      if (
        rewardType === "discount" &&
        (!discountValue || Number(discountValue) <= 0)
      ) {
        setErrorMessage("Discount value is required for discount rewards.");
        return;
      }

      const slug = slugify(rewardName);

      const { error } = await supabase.from("loyalty_rewards").insert({
        tenant_id: tenantId,
        name: rewardName,
        slug,
        description: rewardDescription || null,
        reward_type: rewardType,
        points_cost: Number(pointsCost),
        discount_type: rewardType === "discount" ? discountType : null,
        discount_value:
          rewardType === "discount" || rewardType === "store_credit"
            ? Number(discountValue || 0)
            : null,
        free_shipping:
          rewardType === "free_shipping" ? true : Boolean(freeShipping),
        minimum_order_amount: minimumOrderAmount
          ? Number(minimumOrderAmount)
          : null,
        usage_limit: usageLimit ? Number(usageLimit) : null,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        status: "active",
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      resetRewardForm();
      setSuccessMessage("Reward created successfully.");
      fetchLoyalty();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to create reward.");
    } finally {
      setCreatingReward(false);
    }
  };

  const handleToggleRewardStatus = async (reward: LoyaltyReward) => {
    if (!tenantId) return;

    try {
      setUpdatingRewardId(reward.id);
      setErrorMessage("");
      setSuccessMessage("");

      const nextStatus = reward.status === "active" ? "inactive" : "active";

      const { error } = await supabase
        .from("loyalty_rewards")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reward.id)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(`Reward marked as ${nextStatus}.`);
      fetchLoyalty();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to update reward.");
    } finally {
      setUpdatingRewardId(null);
    }
  };

  const handleArchiveReward = async (reward: LoyaltyReward) => {
    if (!tenantId) return;

    const confirmed = confirm(`Archive reward "${reward.name}"?`);
    if (!confirmed) return;

    try {
      setUpdatingRewardId(reward.id);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("loyalty_rewards")
        .update({
          status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reward.id)
        .eq("tenant_id", tenantId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Reward archived.");
      fetchLoyalty();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to archive reward.");
    } finally {
      setUpdatingRewardId(null);
    }
  };

  const getTransactionTone = (type: string) => {
    switch (type) {
      case "earned":
      case "adjustment_add":
      case "reward_bonus":
        return "text-green-700";
      case "redeemed":
      case "expired":
      case "refund_reversal":
      case "adjustment_deduct":
        return "text-red-700";
      default:
        return "text-slate-700";
    }
  };

  if (loading) {
    return <p className="text-slate-500">Loading loyalty dashboard...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Loyalty Program</h1>
        <p className="text-slate-500 mt-2">
          Configure customer points, rewards, earning rules, and redemption
          behavior.
        </p>
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
        <StatCard label="Loyalty Customers" value={stats.loyaltyCustomers} />
        <StatCard
          label="Points Outstanding"
          value={stats.totalPointsBalance.toLocaleString()}
        />
        <StatCard
          label="Points Liability"
          value={money(stats.pointsValueLiability)}
        />
        <StatCard label="Active Rewards" value={stats.activeRewards} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard
          label="Lifetime Earned"
          value={stats.lifetimeEarned.toLocaleString()}
        />
        <StatCard
          label="Lifetime Redeemed"
          value={stats.lifetimeRedeemed.toLocaleString()}
        />
        <StatCard
          label="Lifetime Expired"
          value={stats.lifetimeExpired.toLocaleString()}
        />
        <StatCard label="Reward Uses" value={stats.totalRewardUsage} />
      </div>

      {settings && (
        <div className="bg-white rounded-2xl shadow p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Loyalty Settings</h2>
            <p className="text-sm text-slate-500 mt-1">
              Control how customers earn and redeem points.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="border rounded-xl p-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={settings.is_enabled}
                onChange={(e) =>
                  handleSettingsChange("is_enabled", e.target.checked)
                }
                className="mt-1"
              />
              <div>
                <p className="font-medium">Enable loyalty</p>
                <p className="text-xs text-slate-500">
                  Let customers earn points.
                </p>
              </div>
            </label>

            <label className="border rounded-xl p-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={settings.allow_points_redemption}
                onChange={(e) =>
                  handleSettingsChange(
                    "allow_points_redemption",
                    e.target.checked
                  )
                }
                className="mt-1"
              />
              <div>
                <p className="font-medium">Allow redemption</p>
                <p className="text-xs text-slate-500">
                  Customers can use points.
                </p>
              </div>
            </label>

            <label className="border rounded-xl p-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={settings.earn_on_discounted_amount}
                onChange={(e) =>
                  handleSettingsChange(
                    "earn_on_discounted_amount",
                    e.target.checked
                  )
                }
                className="mt-1"
              />
              <div>
                <p className="font-medium">Earn after discount</p>
                <p className="text-xs text-slate-500">
                  Calculate points after coupons.
                </p>
              </div>
            </label>

            <label className="border rounded-xl p-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={settings.earn_on_shipping}
                onChange={(e) =>
                  handleSettingsChange("earn_on_shipping", e.target.checked)
                }
                className="mt-1"
              />
              <div>
                <p className="font-medium">Earn on shipping</p>
                <p className="text-xs text-slate-500">
                  Include shipping in points.
                </p>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              value={settings.reward_name || ""}
              onChange={(e) =>
                handleSettingsChange("reward_name", e.target.value)
              }
              placeholder="Reward name"
              className="border rounded-xl p-3"
            />

            <input
              value={settings.reward_currency_label || ""}
              onChange={(e) =>
                handleSettingsChange("reward_currency_label", e.target.value)
              }
              placeholder="Points label"
              className="border rounded-xl p-3"
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={settings.points_per_currency}
              onChange={(e) =>
                handleSettingsChange(
                  "points_per_currency",
                  Number(e.target.value)
                )
              }
              placeholder="Points per GHS 1"
              className="border rounded-xl p-3"
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={settings.currency_per_point}
              onChange={(e) =>
                handleSettingsChange(
                  "currency_per_point",
                  Number(e.target.value)
                )
              }
              placeholder="GHS value per point"
              className="border rounded-xl p-3"
            />

            <input
              type="number"
              min="0"
              value={settings.minimum_points_to_redeem}
              onChange={(e) =>
                handleSettingsChange(
                  "minimum_points_to_redeem",
                  Number(e.target.value)
                )
              }
              placeholder="Minimum redeem points"
              className="border rounded-xl p-3"
            />

            <input
              type="number"
              min="0"
              value={settings.maximum_points_per_order || ""}
              onChange={(e) =>
                handleSettingsChange(
                  "maximum_points_per_order",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              placeholder="Max points per order optional"
              className="border rounded-xl p-3"
            />

            <input
              type="number"
              min="1"
              value={settings.points_expiry_days || ""}
              onChange={(e) =>
                handleSettingsChange(
                  "points_expiry_days",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              placeholder="Expiry days optional"
              className="border rounded-xl p-3"
            />

            <select
              value={settings.status}
              onChange={(e) =>
                handleSettingsChange("status", e.target.value)
              }
              className="border rounded-xl p-3"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {savingSettings ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Create Reward</h2>
          <p className="text-sm text-slate-500 mt-1">
            Create rewards customers can redeem with their points.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            value={rewardName}
            onChange={(e) => setRewardName(e.target.value)}
            placeholder="Reward name"
            className="border rounded-xl p-3"
          />

          <input
            value={pointsCost}
            onChange={(e) => setPointsCost(e.target.value)}
            type="number"
            min="1"
            placeholder="Points cost"
            className="border rounded-xl p-3"
          />

          <select
            value={rewardType}
            onChange={(e) => setRewardType(e.target.value)}
            className="border rounded-xl p-3"
          >
            <option value="discount">Discount</option>
            <option value="free_shipping">Free Shipping</option>
            <option value="store_credit">Store Credit</option>
            <option value="custom">Custom</option>
          </select>

          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            disabled={rewardType !== "discount"}
            className="border rounded-xl p-3 disabled:bg-slate-100"
          >
            <option value="fixed">Fixed Amount</option>
            <option value="percentage">Percentage</option>
          </select>

          <input
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder={
              rewardType === "discount"
                ? "Discount value"
                : rewardType === "store_credit"
                  ? "Credit value"
                  : "Value optional"
            }
            className="border rounded-xl p-3"
          />

          <input
            value={minimumOrderAmount}
            onChange={(e) => setMinimumOrderAmount(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="Minimum order optional"
            className="border rounded-xl p-3"
          />

          <input
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            type="number"
            min="0"
            placeholder="Usage limit optional"
            className="border rounded-xl p-3"
          />

          <label className="border rounded-xl p-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={freeShipping}
              onChange={(e) => setFreeShipping(e.target.checked)}
            />
            Free shipping
          </label>

          <input
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            type="datetime-local"
            className="border rounded-xl p-3"
          />

          <input
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            type="datetime-local"
            className="border rounded-xl p-3"
          />

          <input
            value={rewardDescription}
            onChange={(e) => setRewardDescription(e.target.value)}
            placeholder="Description optional"
            className="border rounded-xl p-3 md:col-span-2"
          />
        </div>

        <button
          onClick={handleCreateReward}
          disabled={creatingReward}
          className="bg-black text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50"
        >
          {creatingReward ? "Creating..." : "Create Reward"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Rewards">
          {rewards.length === 0 ? (
            <p className="text-slate-500">No rewards created yet.</p>
          ) : (
            <div className="space-y-4">
              {rewards.map((reward) => (
                <div key={reward.id} className="border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs capitalize">
                          {formatType(reward.reward_type)}
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full text-xs capitalize ${
                            reward.status === "active"
                              ? "bg-green-100 text-green-700"
                              : reward.status === "archived"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {reward.status}
                        </span>
                      </div>

                      <h3 className="font-semibold text-lg mt-3">
                        {reward.name}
                      </h3>

                      <p className="text-sm text-slate-500 mt-2">
                        {reward.description || "No description"}
                      </p>

                      <div className="text-sm text-slate-500 mt-3 space-y-1">
                        <p>Cost: {reward.points_cost.toLocaleString()} points</p>

                        {reward.reward_type === "discount" && (
                          <p>
                            Discount:{" "}
                            {reward.discount_type === "percentage"
                              ? `${Number(reward.discount_value || 0)}%`
                              : money(Number(reward.discount_value || 0))}
                          </p>
                        )}

                        {reward.free_shipping && <p>Includes free shipping</p>}

                        {reward.minimum_order_amount !== null && (
                          <p>
                            Minimum order:{" "}
                            {money(Number(reward.minimum_order_amount || 0))}
                          </p>
                        )}

                        {reward.usage_limit !== null && (
                          <p>
                            Usage: {reward.used_count}/{reward.usage_limit}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {reward.used_count}
                      </p>
                      <p className="text-xs text-slate-500">uses</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-5">
                    {reward.status !== "archived" && (
                      <button
                        onClick={() => handleToggleRewardStatus(reward)}
                        disabled={updatingRewardId === reward.id}
                        className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100 disabled:opacity-50"
                      >
                        {reward.status === "active"
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    )}

                    <button
                      onClick={() => handleArchiveReward(reward)}
                      disabled={updatingRewardId === reward.id}
                      className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-600 disabled:opacity-50"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top Loyalty Customers">
          {topPointCustomers.length === 0 ? (
            <p className="text-slate-500">No loyalty customers yet.</p>
          ) : (
            <div className="space-y-4">
              {topPointCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="border rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold">
                      {customer.full_name || "Unnamed Customer"}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {customer.email || customer.phone || "No contact"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {customer.total_orders || 0} order(s)
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">
                      {Number(customer.points_balance || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">points</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Top Points Earners">
          {topEarners.length === 0 ? (
            <p className="text-slate-500">No points earned yet.</p>
          ) : (
            <div className="space-y-4">
              {topEarners.map((customer) => (
                <div
                  key={customer.id}
                  className="border rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold">
                      {customer.full_name || "Unnamed Customer"}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {customer.email || customer.phone || "No contact"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {money(Number(customer.total_spent || 0))} spent
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">
                      {Number(
                        customer.lifetime_points_earned || 0
                      ).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">earned</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent Loyalty Activity">
          {transactions.length === 0 ? (
            <p className="text-slate-500">No loyalty activity yet.</p>
          ) : (
            <div className="space-y-4">
              {transactions.slice(0, 10).map((transaction) => {
                const isNegative =
                  transaction.type === "redeemed" ||
                  transaction.type === "expired" ||
                  transaction.type === "refund_reversal" ||
                  transaction.type === "adjustment_deduct";

                return (
                  <div
                    key={transaction.id}
                    className="border rounded-2xl p-4 flex items-center justify-between gap-4"
                  >
                    <div>
                      <h3 className="font-semibold capitalize">
                        {formatType(transaction.type)}
                      </h3>

                      <p className="text-sm text-slate-500 mt-1">
                        {transaction.description || transaction.status}
                      </p>

                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>

                      {transaction.order_id && (
                        <p className="text-xs text-slate-400 mt-1">
                          Order #{transaction.order_id.slice(0, 8)}
                        </p>
                      )}
                    </div>

                    <p
                      className={`font-bold ${getTransactionTone(
                        transaction.type
                      )}`}
                    >
                      {isNegative ? "-" : "+"}
                      {Math.abs(Number(transaction.points || 0)).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
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

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-xl font-semibold mb-6">{title}</h2>
      {children}
    </div>
  );
}