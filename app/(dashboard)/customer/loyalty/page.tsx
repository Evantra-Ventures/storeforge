"use client";

import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
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

type CustomerProfile = {
  id: string;
  tenant_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type LoyaltyAccount = {
  id: string;
  tenant_id: string;
  customer_profile_id: string;
  user_id: string;
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
  reward_redemption_id: string | null;
  expires_at: string | null;
  created_at: string;
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
};

type RewardRedemption = {
  id: string;
  reward_id: string | null;
  order_id: string | null;
  points_redeemed: number;
  discount_amount: number;
  free_shipping_applied: boolean;
  code: string | null;
  status: string;
  redeemed_at: string;
  applied_at: string | null;
  cancelled_at: string | null;
  reward:
    | {
        id: string;
        name: string;
        reward_type: string;
      }
    | {
        id: string;
        name: string;
        reward_type: string;
      }[]
    | null;
};

export default function CustomerLoyaltyPage() {
  const supabase = createClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [customerProfile, setCustomerProfile] =
    useState<CustomerProfile | null>(null);
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);

  const [loading, setLoading] = useState(true);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const currency = "GHS";

  const money = (value: number) =>
    `${currency} ${Number(value || 0).toFixed(2)}`;

  const formatType = (value: string) =>
    value.replaceAll("_", " ").replaceAll(".", " ");

  const getReward = (redemption: RewardRedemption) => {
    if (!redemption.reward) return null;
    return Array.isArray(redemption.reward)
      ? redemption.reward[0]
      : redemption.reward;
  };

  const fetchLoyaltyData = async () => {
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

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      let resolvedTenantId = profileRow?.tenant_id || null;

      if (!resolvedTenantId) {
        const { data: tenantRow } = await supabase
          .from("tenants")
          .select("id")
          .limit(1)
          .maybeSingle();

        resolvedTenantId = tenantRow?.id || null;
      }

      if (!resolvedTenantId) {
        setErrorMessage("Tenant not found.");
        return;
      }

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

      const { data: ensuredProfileId, error: profileError } =
        await supabase.rpc("ensure_customer_profile", {
          p_tenant_id: resolvedTenantId,
          p_user_id: user.id,
          p_full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null,
          p_email: user.email || null,
          p_phone: user.phone || null,
        });

      if (profileError) {
        setErrorMessage(profileError.message);
        return;
      }

      const { data: customerProfileData, error: customerProfileError } =
        await supabase
          .from("customer_profiles")
          .select("id,tenant_id,user_id,full_name,email,phone")
          .eq("id", ensuredProfileId)
          .maybeSingle();

      if (customerProfileError || !customerProfileData) {
        setErrorMessage(
          customerProfileError?.message || "Customer profile not found."
        );
        return;
      }

      setCustomerProfile(customerProfileData);

      const { data: loyaltyAccountId, error: accountEnsureError } =
        await supabase.rpc("ensure_customer_loyalty_account", {
          p_tenant_id: resolvedTenantId,
          p_customer_profile_id: customerProfileData.id,
          p_user_id: user.id,
        });

      if (accountEnsureError) {
        setErrorMessage(accountEnsureError.message);
        return;
      }

      const { data: accountData, error: accountError } = await supabase
        .from("customer_loyalty_accounts")
        .select("*")
        .eq("id", loyaltyAccountId)
        .maybeSingle();

      if (accountError) {
        setErrorMessage(accountError.message);
        return;
      }

      setAccount(accountData || null);

      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("loyalty_transactions")
          .select("*")
          .eq("tenant_id", resolvedTenantId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30);

      if (transactionsError) {
        setErrorMessage(transactionsError.message);
        return;
      }

      setTransactions(transactionsData || []);

      const { data: rewardsData, error: rewardsError } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("tenant_id", resolvedTenantId)
        .eq("status", "active")
        .order("points_cost", { ascending: true });

      if (rewardsError) {
        setErrorMessage(rewardsError.message);
        return;
      }

      setRewards(rewardsData || []);

      const { data: redemptionsData, error: redemptionsError } = await supabase
        .from("loyalty_reward_redemptions")
        .select(`
          id,
          reward_id,
          order_id,
          points_redeemed,
          discount_amount,
          free_shipping_applied,
          code,
          status,
          redeemed_at,
          applied_at,
          cancelled_at,
          reward:loyalty_rewards (
            id,
            name,
            reward_type
          )
        `)
        .eq("tenant_id", resolvedTenantId)
        .eq("user_id", user.id)
        .order("redeemed_at", { ascending: false });

      if (redemptionsError) {
        setErrorMessage(redemptionsError.message);
        return;
      }

      setRedemptions(redemptionsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load loyalty information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoyaltyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableRewards = useMemo(() => {
    const now = Date.now();

    return rewards.filter((reward) => {
      if (reward.starts_at && new Date(reward.starts_at).getTime() > now) {
        return false;
      }

      if (reward.ends_at && new Date(reward.ends_at).getTime() < now) {
        return false;
      }

      if (
        reward.usage_limit !== null &&
        Number(reward.used_count || 0) >= Number(reward.usage_limit)
      ) {
        return false;
      }

      return true;
    });
  }, [rewards]);

  const stats = useMemo(() => {
    const expiringSoon = transactions.filter((transaction) => {
      if (!transaction.expires_at || transaction.status !== "completed") {
        return false;
      }

      const expiresAt = new Date(transaction.expires_at).getTime();
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;

      return expiresAt > now && expiresAt <= now + thirtyDays;
    });

    return {
      balance: Number(account?.points_balance || 0),
      lifetimeEarned: Number(account?.lifetime_points_earned || 0),
      lifetimeRedeemed: Number(account?.lifetime_points_redeemed || 0),
      lifetimeExpired: Number(account?.lifetime_points_expired || 0),
      expiringSoonPoints: expiringSoon.reduce(
        (acc, item) => acc + Number(item.points || 0),
        0
      ),
      activeRedemptions: redemptions.filter(
        (item) => item.status === "active"
      ).length,
      appliedRedemptions: redemptions.filter(
        (item) => item.status === "applied"
      ).length,
    };
  }, [account, transactions, redemptions]);

  const estimatedCashValue =
    stats.balance * Number(settings?.currency_per_point || 0);

  const canRedeemAny =
    !!settings?.allow_points_redemption &&
    stats.balance >= Number(settings?.minimum_points_to_redeem || 0);

  const nextMinimum = Math.max(
    0,
    Number(settings?.minimum_points_to_redeem || 0) - stats.balance
  );

  const handleRedeemReward = async (reward: LoyaltyReward) => {
    if (!tenantId || !account || !customerProfile) return;

    if (!settings?.allow_points_redemption) {
      setErrorMessage("Points redemption is currently disabled.");
      return;
    }

    if (stats.balance < reward.points_cost) {
      setErrorMessage("You do not have enough points for this reward.");
      return;
    }

    const confirmed = confirm(
      `Redeem ${reward.points_cost} points for "${reward.name}"?`
    );

    if (!confirmed) return;

    try {
      setRedeemingRewardId(reward.id);
      setErrorMessage("");
      setSuccessMessage("");

      const discountAmount =
        reward.reward_type === "discount"
          ? reward.discount_type === "percentage"
            ? 0
            : Number(reward.discount_value || 0)
          : reward.reward_type === "store_credit"
          ? Number(reward.discount_value || 0)
          : 0;

      const { data: redemptionData, error: redemptionError } = await supabase
        .from("loyalty_reward_redemptions")
        .insert({
          tenant_id: tenantId,
          loyalty_account_id: account.id,
          customer_profile_id: customerProfile.id,
          user_id: customerProfile.user_id,
          reward_id: reward.id,
          points_redeemed: reward.points_cost,
          discount_amount: discountAmount,
          free_shipping_applied:
            reward.reward_type === "free_shipping" || reward.free_shipping,
          code: `RW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          status: "active",
          metadata: {
            reward_name: reward.name,
            reward_type: reward.reward_type,
          },
        })
        .select("id")
        .single();

      if (redemptionError || !redemptionData) {
        setErrorMessage(redemptionError?.message || "Failed to redeem reward.");
        return;
      }

      const newBalance = stats.balance - reward.points_cost;

      const { error: accountError } = await supabase
        .from("customer_loyalty_accounts")
        .update({
          points_balance: newBalance,
          lifetime_points_redeemed:
            Number(account.lifetime_points_redeemed || 0) + reward.points_cost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)
        .eq("user_id", customerProfile.user_id);

      if (accountError) {
        setErrorMessage(accountError.message);
        return;
      }

      const { data: transactionData, error: transactionError } = await supabase
        .from("loyalty_transactions")
        .insert({
          tenant_id: tenantId,
          loyalty_account_id: account.id,
          customer_profile_id: customerProfile.id,
          user_id: customerProfile.user_id,
          reward_redemption_id: redemptionData.id,
          type: "redeemed",
          status: "completed",
          points: reward.points_cost,
          points_balance_after: newBalance,
          monetary_value: discountAmount,
          description: `Reward redeemed: ${reward.name}`,
          metadata: {
            reward_id: reward.id,
            reward_name: reward.name,
            reward_type: reward.reward_type,
          },
        })
        .select("id")
        .single();

      if (transactionError) {
        setErrorMessage(transactionError.message);
        return;
      }

      await supabase
        .from("loyalty_rewards")
        .update({
          used_count: Number(reward.used_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reward.id)
        .eq("tenant_id", tenantId);

      try {
        await supabase.rpc("create_customer_notification", {
          p_tenant_id: tenantId,
          p_user_id: customerProfile.user_id,
          p_type: "reward_redeemed",
          p_title: "Reward redeemed",
          p_message: `You redeemed ${Number(
            reward.points_cost || 0
          ).toLocaleString()} points for ${reward.name}.`,
          p_channel: "in_app",
          p_priority: "normal",
          p_entity_type: "loyalty_reward",
          p_entity_id: reward.id,
          p_loyalty_transaction_id: transactionData?.id || null,
          p_reward_redemption_id: redemptionData.id,
          p_action_url: "/customer/loyalty",
          p_metadata: {
            idempotency_key: `reward_redeemed:${redemptionData.id}`,
            reward_id: reward.id,
            reward_name: reward.name,
            points_redeemed: reward.points_cost,
            discount_amount: discountAmount,
          },
        });
      } catch (notificationError) {
        console.error("Reward redemption notification error:", notificationError);
      }

      setSuccessMessage("Reward redeemed successfully.");
      fetchLoyaltyData();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to redeem reward.");
    } finally {
      setRedeemingRewardId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-500">Loading loyalty rewards...</p>
      </div>
    );
  }

  if (!settings?.is_enabled) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Loyalty Program
            </h1>
            <p className="mt-2 text-slate-500">
              This store has not enabled loyalty rewards yet.
            </p>
          </div>

          <CustomerNotificationBell tenantId={tenantId || undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.25),transparent_35%)]" />

        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
          <div className="lg:col-span-2">
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Customer engagement & retention
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                  Keep earning. Keep saving.
                </h1>

                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                  Earn points when you shop, redeem rewards, track your balance,
                  and stay updated with customer notifications.
                </p>
              </div>

              <CustomerNotificationBell tenantId={tenantId || undefined} />
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
              <HeroMiniStat label="Tier" value={account?.tier_name || "Bronze"} />
              <HeroMiniStat
                label="Lifetime earned"
                value={stats.lifetimeEarned.toLocaleString()}
              />
              <HeroMiniStat
                label="Lifetime redeemed"
                value={stats.lifetimeRedeemed.toLocaleString()}
              />
              <HeroMiniStat
                label="Expiring soon"
                value={stats.expiringSoonPoints.toLocaleString()}
              />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white p-4 text-slate-950 shadow-2xl">
            <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">
                    {settings?.reward_name || "Loyalty Rewards"}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    Hi{" "}
                    {customerProfile?.full_name
                      ? customerProfile.full_name.split(" ")[0]
                      : "Customer"}{" "}
                    👋
                  </h2>
                </div>

                <div className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  {account?.tier_name || "Bronze"}
                </div>
              </div>

              <div className="mt-8">
                <p className="text-sm text-slate-300">Your balance</p>
                <h3 className="mt-2 text-5xl font-bold">
                  {stats.balance.toLocaleString()}
                </h3>
                <p className="mt-2 text-sm text-slate-300">
                  {settings?.reward_currency_label || "points"} · estimated
                  value {money(estimatedCashValue)}
                </p>
              </div>

              <div className="mt-8 rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span>Minimum redemption</span>
                  <span>
                    {Number(
                      settings?.minimum_points_to_redeem || 0
                    ).toLocaleString()}{" "}
                    pts
                  </span>
                </div>

                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-white"
                    style={{
                      width: `${Math.min(
                        100,
                        (stats.balance /
                          Math.max(
                            Number(settings?.minimum_points_to_redeem || 1),
                            1
                          )) *
                          100
                      )}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs text-slate-300">
                  {canRedeemAny
                    ? "You can redeem available rewards now."
                    : `${nextMinimum.toLocaleString()} more point(s) needed before redemption.`}
                </p>
              </div>

              <a
                href="#available-rewards"
                className="mt-5 block rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-slate-200"
              >
                View rewards
              </a>
            </div>
          </div>
        </div>
      </section>

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

      <section className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <StatCard
          label="Current balance"
          value={stats.balance.toLocaleString()}
          helper={settings?.reward_currency_label || "points"}
        />
        <StatCard
          label="Estimated value"
          value={money(estimatedCashValue)}
          helper="Redeemable value"
        />
        <StatCard
          label="Active rewards"
          value={stats.activeRedemptions}
          helper="Ready to use"
        />
        <StatCard
          label="Applied rewards"
          value={stats.appliedRedemptions}
          helper="Used rewards"
        />
      </section>

      <Panel
        title="How it works"
        description="Understand how points are earned and redeemed in this store."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoCard
            title="Earn points"
            description={`Earn ${Number(
              settings?.points_per_currency || 0
            )} point(s) for every ${currency} 1 spent.`}
          />
          <InfoCard
            title="Redeem points"
            description={`Each point is worth ${money(
              Number(settings?.currency_per_point || 0)
            )}.`}
          />
          <InfoCard
            title="Minimum redemption"
            description={`You need at least ${Number(
              settings?.minimum_points_to_redeem || 0
            ).toLocaleString()} points to redeem.`}
          />
        </div>

        {!canRedeemAny && settings?.allow_points_redemption && (
          <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-700">
            You need {nextMinimum.toLocaleString()} more point(s) before you can
            redeem rewards.
          </div>
        )}
      </Panel>

      <Panel
        id="available-rewards"
        title="Available rewards"
        description="Redeem your points for discounts, store credit, free shipping, or other merchant rewards."
      >
        {availableRewards.length === 0 ? (
          <EmptyState text="No rewards available yet." />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {availableRewards.map((reward) => {
              const canRedeem =
                settings?.allow_points_redemption &&
                stats.balance >= Number(reward.points_cost || 0);

              return (
                <div
                  key={reward.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium capitalize text-purple-700">
                        {formatType(reward.reward_type)}
                      </span>

                      <h3 className="mt-4 text-xl font-bold text-slate-950">
                        {reward.name}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {reward.description ||
                          "Redeem this reward with your points."}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {Number(reward.points_cost || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">points</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
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

                    {reward.ends_at && (
                      <p>
                        Ends: {new Date(reward.ends_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleRedeemReward(reward)}
                    disabled={!canRedeem || redeemingRewardId === reward.id}
                    className="mt-5 w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {redeemingRewardId === reward.id
                      ? "Redeeming..."
                      : canRedeem
                      ? "Redeem reward"
                      : "Not enough points"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Panel
          title="My reward redemptions"
          description="Track the rewards you have redeemed and their current status."
        >
          {redemptions.length === 0 ? (
            <EmptyState text="You have not redeemed any rewards yet." />
          ) : (
            <div className="space-y-4">
              {redemptions.map((redemption) => {
                const reward = getReward(redemption);

                return (
                  <div
                    key={redemption.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-700">
                            {reward?.name || "Reward"}
                          </span>

                          <StatusBadge status={redemption.status} />
                        </div>

                        <p className="mt-3 text-sm text-slate-500">
                          Redeemed{" "}
                          {new Date(redemption.redeemed_at).toLocaleString()}
                        </p>

                        {redemption.code && (
                          <p className="mt-2 text-sm">
                            Code:{" "}
                            <span className="font-mono font-semibold">
                              {redemption.code}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="md:text-right">
                        <p className="font-bold">
                          -{redemption.points_redeemed.toLocaleString()} points
                        </p>

                        {Number(redemption.discount_amount || 0) > 0 && (
                          <p className="text-sm text-green-700">
                            {money(Number(redemption.discount_amount || 0))} value
                          </p>
                        )}

                        {redemption.free_shipping_applied && (
                          <p className="text-sm text-green-700">
                            Free shipping
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Recent points history"
          description="See how your balance changes from earning, redeeming, expiry, and adjustments."
        >
          {transactions.length === 0 ? (
            <EmptyState text="No points history yet." />
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => {
                const isNegative =
                  transaction.type === "redeemed" ||
                  transaction.type === "expired" ||
                  transaction.type === "refund_reversal" ||
                  transaction.type === "adjustment_deduct";

                return (
                  <div
                    key={transaction.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs capitalize ${
                              isNegative
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {formatType(transaction.type)}
                          </span>

                          <StatusBadge status={transaction.status} />
                        </div>

                        <h3 className="mt-3 font-semibold text-slate-950">
                          {transaction.description ||
                            formatType(transaction.type)}
                        </h3>

                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(transaction.created_at).toLocaleString()}
                        </p>

                        {transaction.expires_at && (
                          <p className="mt-1 text-xs text-orange-600">
                            Expires{" "}
                            {new Date(transaction.expires_at).toLocaleDateString()}
                          </p>
                        )}

                        {transaction.order_id && (
                          <p className="mt-1 text-xs text-slate-400">
                            Order #{transaction.order_id.slice(0, 8)}
                          </p>
                        )}
                      </div>

                      <div className="md:text-right">
                        <p
                          className={`text-lg font-bold ${
                            isNegative ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {isNegative ? "-" : "+"}
                          {Math.abs(
                            Number(transaction.points || 0)
                          ).toLocaleString()}
                        </p>

                        <p className="text-xs text-slate-500">
                          Balance after:{" "}
                          {Number(
                            transaction.points_balance_after || 0
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function HeroMiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs text-slate-300">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        {value}
      </h2>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
        ✓
      </div>

      <h3 className="font-bold text-slate-950">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusClass =
    status === "active" || status === "completed" || status === "applied"
      ? "bg-green-100 text-green-700"
      : status === "pending"
      ? "bg-yellow-100 text-yellow-700"
      : status === "cancelled" || status === "failed"
      ? "bg-red-100 text-red-700"
      : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs capitalize ${statusClass}`}
    >
      {status}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}