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
    return <p className="text-slate-500">Loading loyalty rewards...</p>;
  }

  if (!settings?.is_enabled) {
    return (
      <div className="bg-white rounded-2xl shadow p-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Loyalty Program</h1>
            <p className="text-slate-500 mt-2">
              This store has not enabled loyalty rewards yet.
            </p>
          </div>

          <CustomerNotificationBell />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {settings?.reward_name || "Loyalty Rewards"}
          </h1>
          <p className="text-slate-500 mt-2">
            Earn points when you shop and redeem them for rewards.
          </p>
        </div>

        <CustomerNotificationBell />
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

      <div className="bg-gradient-to-br from-black to-slate-800 text-white rounded-3xl shadow p-8">
        <p className="text-sm text-slate-300">Current Balance</p>

        <h2 className="text-5xl font-bold mt-3">
          {stats.balance.toLocaleString()}{" "}
          <span className="text-xl">
            {settings?.reward_currency_label || "points"}
          </span>
        </h2>

        <p className="text-slate-300 mt-4">
          Estimated value: {money(estimatedCashValue)}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <MiniStat label="Tier" value={account?.tier_name || "Bronze"} />
          <MiniStat
            label="Lifetime Earned"
            value={stats.lifetimeEarned.toLocaleString()}
          />
          <MiniStat
            label="Lifetime Redeemed"
            value={stats.lifetimeRedeemed.toLocaleString()}
          />
          <MiniStat
            label="Expiring Soon"
            value={stats.expiringSoonPoints.toLocaleString()}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold mb-4">How It Works</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="border rounded-2xl p-4">
            <p className="font-semibold">Earn Points</p>
            <p className="text-slate-500 mt-2">
              Earn {Number(settings?.points_per_currency || 0)} point(s) for
              every {currency} 1 spent.
            </p>
          </div>

          <div className="border rounded-2xl p-4">
            <p className="font-semibold">Redeem Points</p>
            <p className="text-slate-500 mt-2">
              Each point is worth {money(Number(settings?.currency_per_point || 0))}.
            </p>
          </div>

          <div className="border rounded-2xl p-4">
            <p className="font-semibold">Minimum Redemption</p>
            <p className="text-slate-500 mt-2">
              You need at least{" "}
              {Number(settings?.minimum_points_to_redeem || 0).toLocaleString()}{" "}
              points to redeem.
            </p>
          </div>
        </div>

        {!canRedeemAny && settings?.allow_points_redemption && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-2xl p-4 mt-5">
            You need{" "}
            {Math.max(
              0,
              Number(settings?.minimum_points_to_redeem || 0) - stats.balance
            ).toLocaleString()}{" "}
            more point(s) before you can redeem rewards.
          </div>
        )}
      </div>

      <Panel title="Available Rewards">
        {availableRewards.length === 0 ? (
          <p className="text-slate-500">No rewards available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {availableRewards.map((reward) => {
              const canRedeem =
                settings?.allow_points_redemption &&
                stats.balance >= Number(reward.points_cost || 0);

              return (
                <div key={reward.id} className="border rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="px-3 py-1 rounded-full text-xs bg-purple-100 text-purple-700 capitalize">
                        {formatType(reward.reward_type)}
                      </span>

                      <h3 className="font-semibold text-lg mt-3">
                        {reward.name}
                      </h3>

                      <p className="text-sm text-slate-500 mt-2">
                        {reward.description || "Redeem this reward with points."}
                      </p>
                    </div>

                    <p className="font-bold text-right">
                      {Number(reward.points_cost || 0).toLocaleString()}
                      <br />
                      <span className="text-xs text-slate-500 font-normal">
                        points
                      </span>
                    </p>
                  </div>

                  <div className="mt-4 text-sm text-slate-500 space-y-1">
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
                    className="w-full bg-black text-white py-3 rounded-xl mt-5 disabled:opacity-50"
                  >
                    {redeemingRewardId === reward.id
                      ? "Redeeming..."
                      : canRedeem
                      ? "Redeem Reward"
                      : "Not Enough Points"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="My Reward Redemptions">
        {redemptions.length === 0 ? (
          <p className="text-slate-500">You have not redeemed any rewards yet.</p>
        ) : (
          <div className="space-y-4">
            {redemptions.map((redemption) => {
              const reward = getReward(redemption);

              return (
                <div
                  key={redemption.id}
                  className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs">
                        {reward?.name || "Reward"}
                      </span>

                      <span
                        className={`px-3 py-1 rounded-full text-xs capitalize ${
                          redemption.status === "active"
                            ? "bg-green-100 text-green-700"
                            : redemption.status === "applied"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {redemption.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500 mt-3">
                      Redeemed {new Date(redemption.redeemed_at).toLocaleString()}
                    </p>

                    {redemption.code && (
                      <p className="text-sm mt-2">
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
                      <p className="text-sm text-green-700">Free shipping</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Points History">
        {transactions.length === 0 ? (
          <p className="text-slate-500">No points history yet.</p>
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
                  className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-3 py-1 rounded-full text-xs capitalize ${
                          isNegative
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {formatType(transaction.type)}
                      </span>

                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">
                        {transaction.status}
                      </span>
                    </div>

                    <h3 className="font-semibold mt-3">
                      {transaction.description || formatType(transaction.type)}
                    </h3>

                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(transaction.created_at).toLocaleString()}
                    </p>

                    {transaction.expires_at && (
                      <p className="text-xs text-orange-600 mt-1">
                        Expires {new Date(transaction.expires_at).toLocaleDateString()}
                      </p>
                    )}

                    {transaction.order_id && (
                      <p className="text-xs text-slate-400 mt-1">
                        Order #{transaction.order_id.slice(0, 8)}
                      </p>
                    )}
                  </div>

                  <div className="md:text-right">
                    <p
                      className={`font-bold text-lg ${
                        isNegative ? "text-red-700" : "text-green-700"
                      }`}
                    >
                      {isNegative ? "-" : "+"}
                      {Math.abs(Number(transaction.points || 0)).toLocaleString()}
                    </p>

                    <p className="text-xs text-slate-500">
                      Balance after:{" "}
                      {Number(transaction.points_balance_after || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CustomerNav({
  unreadNotificationsCount,
}: {
  unreadNotificationsCount: number;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <a
        href="/customer/profile"
        className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
      >
        My Profile
      </a>

      <a
        href="/my-orders"
        className="border px-4 py-2 rounded-xl text-sm hover:bg-slate-100"
      >
        My Orders
      </a>

     <CustomerNotificationBell />

    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white/10 rounded-2xl p-4">
      <p className="text-xs text-slate-300">{label}</p>
      <p className="font-bold mt-1">{value}</p>
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