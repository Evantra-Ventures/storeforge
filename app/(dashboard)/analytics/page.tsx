"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  total_amount: number;
  discount_amount: number | null;
  shipping_fee: number | null;
  refunded_amount: number | null;
  status: string | null;
  payment_status: string | null;
  coupon_code: string | null;
  delivery_method: string | null;
  delivery_status: string | null;
};

type OrderItem = {
  id: string;
  quantity: number;
  price: number;
  product_id: string | null;
  variant_id: string | null;
  product: { id: string; name: string } | null;
  variant: {
    id: string;
    name: string;
    option_name: string;
    option_value: string;
    sku: string | null;
  } | null;
};

type Product = {
  id: string;
  name: string;
  inventory: number;
  low_stock_threshold: number;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  option_name: string;
  option_value: string;
  inventory: number;
  low_stock_threshold: number;
  product:
  | { id: string; name: string }
  | { id: string; name: string }[]
  | null;
};

type Review = {
  id: string;
  product_id: string;
  rating: number;
  status: string;
  is_verified_purchase: boolean;
  product: { id: string; name: string } | { id: string; name: string }[] | null;
};

type WishlistItem = {
  id: string;
  product_id: string;
  product: { id: string; name: string } | { id: string; name: string }[] | null;
};

type Wallet = {
  id: string;
  tenant_id: string;
  pending_balance: number;
  available_balance: number;
  platform_balance_due: number;
  lifetime_earnings: number;
  lifetime_payouts: number;
  lifetime_fees: number;
  lifetime_refunds: number;
  currency: string;
};

type MerchantTransaction = {
  id: string;
  type: string;
  status: string;
  gross_amount: number;
  platform_fee_amount: number;
  payment_processor_fee_amount: number;
  net_amount: number;
  balance_type: string;
  description: string | null;
  order_id: string | null;
  payout_id: string | null;
  created_at: string;
};

type MerchantPayout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  requested_at: string;
  paid_at: string | null;
  rejected_at: string | null;
};

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
};

type LoyaltySummary = {
  id: string;
  tenant_id: string;
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

type LoyaltyReward = {
  id: string;
  tenant_id: string;
  name: string;
  reward_type: string;
  points_cost: number;
  status: string;
  used_count: number;
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

type LoyaltySettings = {
  id: string;
  tenant_id: string;
  currency_per_point: number;
  points_per_currency: number;
  is_enabled: boolean;
  reward_name: string;
  reward_currency_label: string;
};

export default function AnalyticsPage() {
  const supabase = createClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<
    MerchantTransaction[]
  >([]);
  const [payouts, setPayouts] = useState<MerchantPayout[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loyaltyCustomers, setLoyaltyCustomers] = useState<LoyaltySummary[]>([]);
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<
    LoyaltyTransaction[]
  >([]);
  const [loyaltySettings, setLoyaltySettings] =
    useState<LoyaltySettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const money = (value: number, currency = wallet?.currency || "GHS") =>
    `${currency} ${Number(value || 0).toFixed(2)}`;

  const formatType = (value: string) => value.replaceAll("_", " ");

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

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

      const tenantId = profile.tenant_id;

      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      setOrders(ordersData || []);

      const orderIds = (ordersData || []).map((order) => order.id);

      if (orderIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("order_items")
          .select(`
            id,
            quantity,
            price,
            product_id,
            variant_id,
            product:products (
              id,
              name
            ),
            variant:product_variants (
              id,
              name,
              option_name,
              option_value,
              sku
            )
          `)
          .in("order_id", orderIds);

        setOrderItems(
          (itemsData || []).map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
            price: item.price,
            product_id: item.product_id,
            variant_id: item.variant_id,
            product: Array.isArray(item.product)
              ? item.product[0]
              : item.product,
            variant: item.variant
              ? Array.isArray(item.variant)
                ? item.variant[0]
                : item.variant
              : null,
          }))
        );
      } else {
        setOrderItems([]);
      }

      const { data: productsData } = await supabase
        .from("products")
        .select("id,name,inventory,low_stock_threshold")
        .eq("tenant_id", tenantId);

      setProducts(productsData || []);

      const { data: variantsData } = await supabase
        .from("product_variants")
        .select(`
          id,
          product_id,
          name,
          option_name,
          option_value,
          inventory,
          low_stock_threshold,
          product:products (
            id,
            name
          )
        `)
        .eq("tenant_id", tenantId)
        .eq("status", "active");

      setVariants(variantsData || []);

      const { data: reviewsData } = await supabase
        .from("product_reviews")
        .select(`
          id,
          product_id,
          rating,
          status,
          is_verified_purchase,
          product:products (
            id,
            name
          )
        `)
        .eq("tenant_id", tenantId);

      setReviews(reviewsData || []);

      const { data: wishlistData } = await supabase
        .from("wishlists")
        .select(`
          id,
          product_id,
          product:products (
            id,
            name
          )
        `)
        .eq("tenant_id", tenantId);

      setWishlistItems(wishlistData || []);

      let { data: walletData } = await supabase
        .from("merchant_wallets")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!walletData) {
        await supabase.rpc("ensure_merchant_wallet", {
          p_tenant_id: tenantId,
          p_currency: "GHS",
        });

        const { data: newWalletData } = await supabase
          .from("merchant_wallets")
          .select("*")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        walletData = newWalletData;
      }

      setWallet(walletData || null);

      const { data: transactionsData } = await supabase
        .from("merchant_transactions")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30);

      setWalletTransactions(transactionsData || []);

      const { data: payoutsData } = await supabase
        .from("merchant_payouts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      setPayouts(payoutsData || []);

      const { data: customersData } = await supabase
        .from("customer_profile_summary")
        .select(`
    id,
    tenant_id,
    user_id,
    full_name,
    email,
    phone,
    marketing_email_opt_in,
    marketing_sms_opt_in,
    marketing_whatsapp_opt_in,
    total_orders,
    total_spent,
    last_order_at,
    status,
    created_at
  `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      setCustomers(customersData || []);

      await supabase.rpc("ensure_loyalty_settings", {
        p_tenant_id: tenantId,
      });

      const { data: loyaltySettingsData } = await supabase
        .from("loyalty_settings")
        .select(`
    id,
    tenant_id,
    currency_per_point,
    points_per_currency,
    is_enabled,
    reward_name,
    reward_currency_label
  `)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      setLoyaltySettings(loyaltySettingsData || null);

      const { data: loyaltyCustomersData } = await supabase
        .from("customer_loyalty_summary")
        .select(`
    id,
    tenant_id,
    customer_profile_id,
    user_id,
    full_name,
    email,
    phone,
    total_orders,
    total_spent,
    last_order_at,
    points_balance,
    lifetime_points_earned,
    lifetime_points_redeemed,
    lifetime_points_expired,
    tier_name,
    status
  `)
        .eq("tenant_id", tenantId)
        .order("points_balance", { ascending: false });

      setLoyaltyCustomers(loyaltyCustomersData || []);

      const { data: loyaltyRewardsData } = await supabase
        .from("loyalty_rewards")
        .select(`
    id,
    tenant_id,
    name,
    reward_type,
    points_cost,
    status,
    used_count
  `)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      setLoyaltyRewards(loyaltyRewardsData || []);

      const { data: loyaltyTransactionsData } = await supabase
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
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(20);

      setLoyaltyTransactions(loyaltyTransactionsData || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const stats = useMemo(() => {
    const paidOrders = orders.filter((order) => order.payment_status === "paid");

    const grossRevenue = paidOrders.reduce(
      (acc, order) => acc + Number(order.total_amount || 0),
      0
    );

    const refunds = orders.reduce(
      (acc, order) => acc + Number(order.refunded_amount || 0),
      0
    );

    const discounts = orders.reduce(
      (acc, order) => acc + Number(order.discount_amount || 0),
      0
    );

    const shipping = orders.reduce(
      (acc, order) => acc + Number(order.shipping_fee || 0),
      0
    );

    const totalItemsSold = orderItems.reduce(
      (acc, item) => acc + Number(item.quantity || 0),
      0
    );

    const variantItemsSold = orderItems
      .filter((item) => item.variant_id)
      .reduce((acc, item) => acc + Number(item.quantity || 0), 0);

    const variantRevenue = orderItems
      .filter((item) => item.variant_id)
      .reduce(
        (acc, item) =>
          acc + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );

    const lowStockProducts = products.filter(
      (product) =>
        Number(product.inventory) <= Number(product.low_stock_threshold || 5)
    );

    const lowStockVariants = variants.filter(
      (variant) =>
        Number(variant.inventory) <= Number(variant.low_stock_threshold || 5)
    );

    const activeCustomers = customers.filter(
      (customer) => customer.status === "active"
    );

    const blockedCustomers = customers.filter(
      (customer) => customer.status === "blocked"
    );

    const repeatCustomers = customers.filter(
      (customer) => Number(customer.total_orders || 0) > 1
    );

    const customerTotalSpent = customers.reduce(
      (acc, customer) => acc + Number(customer.total_spent || 0),
      0
    );

    const customerTotalOrders = customers.reduce(
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

    const repeatCustomerRate =
      customers.length > 0 ? (repeatCustomers.length / customers.length) * 100 : 0;

    const averageCustomerValue =
      customers.length > 0 ? customerTotalSpent / customers.length : 0;

    const averageOrdersPerCustomer =
      customers.length > 0 ? customerTotalOrders / customers.length : 0;

    const publishedReviews = reviews.filter(
      (review) => review.status === "published"
    );

    const averageStoreRating =
      publishedReviews.length > 0
        ? publishedReviews.reduce(
          (acc, review) => acc + Number(review.rating),
          0
        ) / publishedReviews.length
        : 0;

    const uniqueWishlistedProducts = new Set(
      wishlistItems.map((item) => item.product_id)
    ).size;

    const pendingPayoutTotal = payouts
      .filter((payout) => payout.status === "pending")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const approvedPayoutTotal = payouts
      .filter((payout) => payout.status === "approved")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const paidPayoutTotal = payouts
      .filter((payout) => payout.status === "paid")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const rejectedPayoutTotal = payouts
      .filter((payout) => payout.status === "rejected")
      .reduce((acc, payout) => acc + Number(payout.amount || 0), 0);

    const walletOrderCredits = walletTransactions
      .filter((transaction) => transaction.type === "order_credit")
      .reduce(
        (acc, transaction) => acc + Number(transaction.net_amount || 0),
        0
      );

    const walletPlatformFees = walletTransactions
      .filter((transaction) => transaction.type === "platform_fee")
      .reduce(
        (acc, transaction) =>
          acc +
          Number(
            transaction.platform_fee_amount || transaction.net_amount || 0
          ),
        0
      );

    const walletProcessorFees = walletTransactions
      .filter((transaction) => transaction.type === "processor_fee")
      .reduce(
        (acc, transaction) =>
          acc +
          Number(
            transaction.payment_processor_fee_amount ||
            transaction.net_amount ||
            0
          ),
        0
      );

    const walletRefundDeductions = walletTransactions
      .filter((transaction) => transaction.type === "refund_deduction")
      .reduce(
        (acc, transaction) => acc + Number(transaction.net_amount || 0),
        0
      );

    const loyaltyPointsOutstanding = loyaltyCustomers.reduce(
      (acc, customer) => acc + Number(customer.points_balance || 0),
      0
    );

    const loyaltyLifetimeEarned = loyaltyCustomers.reduce(
      (acc, customer) => acc + Number(customer.lifetime_points_earned || 0),
      0
    );

    const loyaltyLifetimeRedeemed = loyaltyCustomers.reduce(
      (acc, customer) => acc + Number(customer.lifetime_points_redeemed || 0),
      0
    );

    const loyaltyLifetimeExpired = loyaltyCustomers.reduce(
      (acc, customer) => acc + Number(customer.lifetime_points_expired || 0),
      0
    );

    const loyaltyPointsLiability =
      loyaltyPointsOutstanding * Number(loyaltySettings?.currency_per_point || 0);

    const activeLoyaltyRewards = loyaltyRewards.filter(
      (reward) => reward.status === "active"
    ).length;

    const totalRewardUsage = loyaltyRewards.reduce(
      (acc, reward) => acc + Number(reward.used_count || 0),
      0
    );

    return {
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      pendingOrders: orders.filter((order) => order.payment_status === "pending")
        .length,
      failedOrders: orders.filter((order) => order.payment_status === "failed")
        .length,
      cancelledOrders: orders.filter((order) => order.status === "cancelled")
        .length,
      grossRevenue,
      refunds,
      discounts,
      shipping,
      netRevenue: grossRevenue - refunds,
      totalItemsSold,
      variantItemsSold,
      variantRevenue,
      lowStockProducts,
      lowStockVariants,
      averageOrderValue:
        paidOrders.length > 0 ? grossRevenue / paidOrders.length : 0,

      totalReviews: reviews.length,
      publishedReviews: publishedReviews.length,
      pendingReviews: reviews.filter((review) => review.status === "pending")
        .length,
      hiddenReviews: reviews.filter((review) => review.status === "hidden")
        .length,
      verifiedPurchaseReviews: reviews.filter(
        (review) => review.is_verified_purchase
      ).length,
      averageStoreRating,

      totalCustomers: customers.length,
      activeCustomers: activeCustomers.length,
      blockedCustomers: blockedCustomers.length,
      repeatCustomers: repeatCustomers.length,
      repeatCustomerRate,
      averageCustomerValue,
      averageOrdersPerCustomer,
      emailOptIns,
      smsOptIns,
      whatsappOptIns,

      totalWishlistSaves: wishlistItems.length,
      uniqueWishlistedProducts,

      availableBalance: Number(wallet?.available_balance || 0),
      pendingBalance: Number(wallet?.pending_balance || 0),
      platformBalanceDue: Number(wallet?.platform_balance_due || 0),
      lifetimeEarnings: Number(wallet?.lifetime_earnings || 0),
      lifetimePayouts: Number(wallet?.lifetime_payouts || 0),
      lifetimeFees: Number(wallet?.lifetime_fees || 0),
      lifetimeRefunds: Number(wallet?.lifetime_refunds || 0),

      pendingPayoutTotal,
      approvedPayoutTotal,
      paidPayoutTotal,
      rejectedPayoutTotal,

      walletOrderCredits,
      walletPlatformFees,
      walletProcessorFees,
      walletRefundDeductions,

      loyaltyCustomers: loyaltyCustomers.length,
      loyaltyPointsOutstanding,
      loyaltyPointsLiability,
      loyaltyLifetimeEarned,
      loyaltyLifetimeRedeemed,
      loyaltyLifetimeExpired,
      activeLoyaltyRewards,
      totalLoyaltyRewards: loyaltyRewards.length,
      totalRewardUsage,
    };
  }, [
    orders,
    orderItems,
    products,
    variants,
    reviews,
    customers,
    wishlistItems,
    wallet,
    walletTransactions,
    payouts,
    loyaltyCustomers,
    loyaltyRewards,
    loyaltySettings,
  ]);

  const topProducts = useMemo(() => {
    const map = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();

    orderItems.forEach((item) => {
      const key = item.product_id || item.id;

      const existing = map.get(key) || {
        name: item.product?.name || "Deleted product",
        quantity: 0,
        revenue: 0,
      };

      existing.quantity += Number(item.quantity || 0);
      existing.revenue += Number(item.price || 0) * Number(item.quantity || 0);

      map.set(key, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orderItems]);

  const topVariants = useMemo(() => {
    const map = new Map<
      string,
      { name: string; quantity: number; revenue: number; sku: string | null }
    >();

    orderItems
      .filter((item) => item.variant_id)
      .forEach((item) => {
        const key = item.variant_id || item.id;

        const variantLabel = item.variant
          ? `${item.product?.name || "Product"} — ${item.variant.option_name}: ${item.variant.option_value
          }`
          : `${item.product?.name || "Product"} — Variant`;

        const existing = map.get(key) || {
          name: variantLabel,
          quantity: 0,
          revenue: 0,
          sku: item.variant?.sku || null,
        };

        existing.quantity += Number(item.quantity || 0);
        existing.revenue += Number(item.price || 0) * Number(item.quantity || 0);

        map.set(key, existing);
      });

    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [orderItems]);

  const topRatedProducts = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        ratingTotal: number;
        reviewCount: number;
        averageRating: number;
      }
    >();

    reviews
      .filter((review) => review.status === "published")
      .forEach((review) => {
        const product = Array.isArray(review.product)
          ? review.product[0]
          : review.product;

        const existing = map.get(review.product_id) || {
          name: product?.name || "Deleted product",
          ratingTotal: 0,
          reviewCount: 0,
          averageRating: 0,
        };

        existing.ratingTotal += Number(review.rating);
        existing.reviewCount += 1;
        existing.averageRating = existing.ratingTotal / existing.reviewCount;

        map.set(review.product_id, existing);
      });

    return Array.from(map.values())
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 5);
  }, [reviews]);

  const mostWishlistedProducts = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();

    wishlistItems.forEach((item) => {
      const product = Array.isArray(item.product)
        ? item.product[0]
        : item.product;

      const existing = map.get(item.product_id) || {
        name: product?.name || "Deleted product",
        count: 0,
      };

      existing.count += 1;

      map.set(item.product_id, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [wishlistItems]);

  const topCustomersBySpend = useMemo(() => {
    return [...customers]
      .sort(
        (a, b) => Number(b.total_spent || 0) - Number(a.total_spent || 0)
      )
      .slice(0, 5);
  }, [customers]);

  const topCustomersByOrders = useMemo(() => {
    return [...customers]
      .sort(
        (a, b) => Number(b.total_orders || 0) - Number(a.total_orders || 0)
      )
      .slice(0, 5);
  }, [customers]);

  const recentCustomers = useMemo(() => {
    return [...customers]
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      )
      .slice(0, 5);
  }, [customers]);

  const couponOrders = orders.filter((order) => order.coupon_code);

  const deliveryStats = {
    delivery: orders.filter((order) => order.delivery_method === "delivery")
      .length,
    pickup: orders.filter((order) => order.delivery_method === "pickup").length,
    delivered: orders.filter((order) => order.delivery_status === "delivered")
      .length,
    outForDelivery: orders.filter(
      (order) => order.delivery_status === "out_for_delivery"
    ).length,
  };

  const getVariantProduct = (variant: ProductVariant) => {
    if (!variant.product) return null;
    return Array.isArray(variant.product) ? variant.product[0] : variant.product;
  };

  const getTransactionTone = (type: string) => {
    switch (type) {
      case "order_credit":
      case "pending_to_available":
        return "text-green-700";
      case "platform_fee":
      case "processor_fee":
        return "text-orange-700";
      case "refund_deduction":
        return "text-red-700";
      case "payout_request":
      case "payout_paid":
        return "text-blue-700";
      default:
        return "text-slate-700";
    }
  };

  const topLoyaltyCustomers = useMemo(() => {
    return [...loyaltyCustomers]
      .sort(
        (a, b) => Number(b.points_balance || 0) - Number(a.points_balance || 0)
      )
      .slice(0, 5);
  }, [loyaltyCustomers]);

  const topLoyaltyEarners = useMemo(() => {
    return [...loyaltyCustomers]
      .sort(
        (a, b) =>
          Number(b.lifetime_points_earned || 0) -
          Number(a.lifetime_points_earned || 0)
      )
      .slice(0, 5);
  }, [loyaltyCustomers]);

  const getLoyaltyTransactionTone = (type: string) => {
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
    return <p className="text-slate-500">Loading analytics...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-slate-500 mt-2">
          Track sales, variants, wallet balances, payouts, customers, retention,
          inventory, reviews, wishlists, shipping, and refunds.
        </p>
      </div>

      {errorMessage && (
        <div className="bg-red-100 text-red-700 p-4 rounded-xl">
          {errorMessage}
        </div>
      )}

      {stats.platformBalanceDue > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-5">
          <p className="font-semibold">Platform Balance Due</p>
          <p className="text-sm mt-1">
            Your store currently owes{" "}
            <span className="font-bold">
              {money(stats.platformBalanceDue)}
            </span>{" "}
            to StoreForge because refund deductions exceeded wallet balances.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Net Revenue" value={money(stats.netRevenue)} />
        <StatCard label="Gross Revenue" value={money(stats.grossRevenue)} />
        <StatCard label="Orders" value={stats.totalOrders} />
        <StatCard
          label="Avg. Order Value"
          value={money(stats.averageOrderValue)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Customers" value={stats.totalCustomers} />
        <StatCard label="Repeat Customers" value={stats.repeatCustomers} />
        <StatCard
          label="Repeat Rate"
          value={`${stats.repeatCustomerRate.toFixed(1)}%`}
        />
        <StatCard
          label="Avg. Customer Value"
          value={money(stats.averageCustomerValue)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Active Customers" value={stats.activeCustomers} />
        <StatCard label="Blocked Customers" value={stats.blockedCustomers} />
        <StatCard
          label="Avg. Orders / Customer"
          value={stats.averageOrdersPerCustomer.toFixed(1)}
        />
        <StatCard label="Email Opt-ins" value={stats.emailOptIns} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="SMS Opt-ins" value={stats.smsOptIns} />
        <StatCard label="WhatsApp Opt-ins" value={stats.whatsappOptIns} />
        <StatCard
          label="Top Customer Spend"
          value={
            topCustomersBySpend[0]
              ? money(Number(topCustomersBySpend[0].total_spent || 0))
              : money(0)
          }
        />
        <StatCard
          label="Top Customer Orders"
          value={topCustomersByOrders[0]?.total_orders || 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Available Wallet" value={money(stats.availableBalance)} />
        <StatCard label="Pending Wallet" value={money(stats.pendingBalance)} />
        <StatCard
          label="Platform Due"
          value={money(stats.platformBalanceDue)}
          tone={stats.platformBalanceDue > 0 ? "danger" : "normal"}
        />
        <StatCard
          label="Lifetime Earnings"
          value={money(stats.lifetimeEarnings)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard
          label="Lifetime Payouts"
          value={money(stats.lifetimePayouts)}
        />
        <StatCard label="Platform Fees" value={money(stats.lifetimeFees)} />
        <StatCard
          label="Refund Deductions"
          value={money(stats.lifetimeRefunds)}
        />
        <StatCard
          label="Pending Payouts"
          value={money(stats.pendingPayoutTotal)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Loyalty Customers" value={stats.loyaltyCustomers} />
        <StatCard
          label="Points Outstanding"
          value={stats.loyaltyPointsOutstanding.toLocaleString()}
        />
        <StatCard
          label="Points Liability"
          value={money(stats.loyaltyPointsLiability)}
        />
        <StatCard label="Active Rewards" value={stats.activeLoyaltyRewards} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard
          label="Lifetime Points Earned"
          value={stats.loyaltyLifetimeEarned.toLocaleString()}
        />
        <StatCard
          label="Lifetime Points Redeemed"
          value={stats.loyaltyLifetimeRedeemed.toLocaleString()}
        />
        <StatCard
          label="Lifetime Points Expired"
          value={stats.loyaltyLifetimeExpired.toLocaleString()}
        />
        <StatCard label="Reward Uses" value={stats.totalRewardUsage} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Items Sold" value={stats.totalItemsSold} />
        <StatCard label="Variant Items Sold" value={stats.variantItemsSold} />
        <StatCard label="Variant Revenue" value={money(stats.variantRevenue)} />
        <StatCard label="Refunded" value={money(stats.refunds)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Total Reviews" value={stats.totalReviews} />
        <StatCard
          label="Average Rating"
          value={
            stats.averageStoreRating > 0
              ? `⭐ ${stats.averageStoreRating.toFixed(1)}`
              : "No reviews"
          }
        />
        <StatCard label="Pending Reviews" value={stats.pendingReviews} />
        <StatCard
          label="Verified Reviews"
          value={stats.verifiedPurchaseReviews}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard label="Wishlist Saves" value={stats.totalWishlistSaves} />
        <StatCard
          label="Wishlisted Products"
          value={stats.uniqueWishlistedProducts}
        />
        <StatCard
          label="Low Stock Products"
          value={stats.lowStockProducts.length}
        />
        <StatCard
          label="Low Stock Variants"
          value={stats.lowStockVariants.length}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Wallet Overview">
          <Row label="Available Balance" value={money(stats.availableBalance)} />
          <Row label="Pending Balance" value={money(stats.pendingBalance)} />
          <Row
            label="Platform Balance Due"
            value={money(stats.platformBalanceDue)}
          />
          <Row
            label="Lifetime Merchant Earnings"
            value={money(stats.lifetimeEarnings)}
          />
          <Row
            label="Lifetime Platform Fees"
            value={money(stats.lifetimeFees)}
          />
          <Row
            label="Lifetime Refund Deductions"
            value={money(stats.lifetimeRefunds)}
          />
        </Panel>

        <Panel title="Payout Overview">
          <Row label="Pending Payouts" value={money(stats.pendingPayoutTotal)} />
          <Row
            label="Approved Payouts"
            value={money(stats.approvedPayoutTotal)}
          />
          <Row label="Paid Payouts" value={money(stats.paidPayoutTotal)} />
          <Row
            label="Rejected Payouts"
            value={money(stats.rejectedPayoutTotal)}
          />
          <Row
            label="Lifetime Payouts"
            value={money(stats.lifetimePayouts)}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Recent Wallet Activity">
          {walletTransactions.length === 0 ? (
            <p className="text-slate-500">No wallet transactions yet.</p>
          ) : (
            <div className="space-y-4">
              {walletTransactions.slice(0, 8).map((transaction) => (
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

                    {transaction.order_id && (
                      <p className="text-xs text-slate-400 mt-1">
                        Order #{transaction.order_id.slice(0, 8)}
                      </p>
                    )}

                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(transaction.created_at).toLocaleString()}
                    </p>
                  </div>

                  <p
                    className={`font-bold ${getTransactionTone(
                      transaction.type
                    )}`}
                  >
                    {transaction.type === "platform_fee" ||
                      transaction.type === "processor_fee" ||
                      transaction.type === "refund_deduction"
                      ? "-"
                      : ""}
                    {money(Number(transaction.net_amount || 0))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Wallet Transaction Breakdown">
          <Row
            label="Recent Order Credits"
            value={money(stats.walletOrderCredits)}
          />
          <Row
            label="Recent Platform Fees"
            value={money(stats.walletPlatformFees)}
          />
          <Row
            label="Recent Processor Fees"
            value={money(stats.walletProcessorFees)}
          />
          <Row
            label="Recent Refund Deductions"
            value={money(stats.walletRefundDeductions)}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Top Selling Variants">
          {topVariants.length === 0 ? (
            <p className="text-slate-500">No variant sales yet.</p>
          ) : (
            <div className="space-y-4">
              {topVariants.map((variant) => (
                <div
                  key={variant.name}
                  className="border rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold">{variant.name}</h3>
                    <p className="text-sm text-slate-500">
                      {variant.quantity} sold
                      {variant.sku ? ` · SKU: ${variant.sku}` : ""}
                    </p>
                  </div>

                  <p className="font-bold">{money(variant.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Low Stock Variants">
          {stats.lowStockVariants.length === 0 ? (
            <p className="text-green-700 bg-green-50 border border-green-200 rounded-2xl p-4">
              All variants have healthy stock levels.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.lowStockVariants.map((variant) => {
                const product = getVariantProduct(variant);

                return (
                  <div
                    key={variant.id}
                    className="border rounded-2xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-semibold">
                        {product?.name || "Product"} — {variant.name}
                      </h3>
                      <p className="text-sm text-purple-700">
                        {variant.option_name}: {variant.option_value}
                      </p>
                      <p className="text-sm text-slate-500">
                        Threshold: {variant.low_stock_threshold || 5}
                      </p>
                    </div>

                    <p className="font-bold text-red-600">{variant.inventory}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Loyalty Overview">
          <Row label="Loyalty Customers" value={stats.loyaltyCustomers} />
          <Row
            label="Points Outstanding"
            value={stats.loyaltyPointsOutstanding.toLocaleString()}
          />
          <Row label="Points Liability" value={money(stats.loyaltyPointsLiability)} />
          <Row
            label="Lifetime Points Earned"
            value={stats.loyaltyLifetimeEarned.toLocaleString()}
          />
          <Row
            label="Lifetime Points Redeemed"
            value={stats.loyaltyLifetimeRedeemed.toLocaleString()}
          />
          <Row label="Active Rewards" value={stats.activeLoyaltyRewards} />
        </Panel>

        <Panel title="Recent Loyalty Activity">
          {loyaltyTransactions.length === 0 ? (
            <p className="text-slate-500">No loyalty activity yet.</p>
          ) : (
            <div className="space-y-4">
              {loyaltyTransactions.slice(0, 8).map((transaction) => {
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

                      {transaction.order_id && (
                        <p className="text-xs text-slate-400 mt-1">
                          Order #{transaction.order_id.slice(0, 8)}
                        </p>
                      )}

                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>

                    <p
                      className={`font-bold ${getLoyaltyTransactionTone(
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Top Loyalty Customers">
          {topLoyaltyCustomers.length === 0 ? (
            <p className="text-slate-500">No loyalty customers yet.</p>
          ) : (
            <div className="space-y-4">
              {topLoyaltyCustomers.map((customer) => (
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

        <Panel title="Top Points Earners">
          {topLoyaltyEarners.length === 0 ? (
            <p className="text-slate-500">No points earned yet.</p>
          ) : (
            <div className="space-y-4">
              {topLoyaltyEarners.map((customer) => (
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Customer Retention">
          <Row label="Total Customers" value={stats.totalCustomers} />
          <Row label="Repeat Customers" value={stats.repeatCustomers} />
          <Row label="Repeat Customer Rate" value={`${stats.repeatCustomerRate.toFixed(1)}%`} />
          <Row label="Average Customer Value" value={money(stats.averageCustomerValue)} />
          <Row
            label="Average Orders Per Customer"
            value={stats.averageOrdersPerCustomer.toFixed(1)}
          />
        </Panel>

        <Panel title="Marketing Opt-ins">
          <Row label="Email Opt-ins" value={stats.emailOptIns} />
          <Row label="SMS Opt-ins" value={stats.smsOptIns} />
          <Row label="WhatsApp Opt-ins" value={stats.whatsappOptIns} />
          <Row
            label="No Marketing Opt-in"
            value={
              stats.totalCustomers -
              stats.emailOptIns -
              stats.smsOptIns -
              stats.whatsappOptIns
            }
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Top Customers by Spend">
          {topCustomersBySpend.length === 0 ? (
            <p className="text-slate-500">No customers yet.</p>
          ) : (
            <div className="space-y-4">
              {topCustomersBySpend.map((customer) => (
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

                  <p className="font-bold">
                    {money(Number(customer.total_spent || 0))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top Customers by Orders">
          {topCustomersByOrders.length === 0 ? (
            <p className="text-slate-500">No customers yet.</p>
          ) : (
            <div className="space-y-4">
              {topCustomersByOrders.map((customer) => (
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

                  <p className="font-bold">
                    {customer.total_orders || 0} order(s)
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Recent Customers">
        {recentCustomers.length === 0 ? (
          <p className="text-slate-500">No recent customers.</p>
        ) : (
          <div className="space-y-4">
            {recentCustomers.map((customer) => (
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
                    Joined {new Date(customer.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold">
                    {money(Number(customer.total_spent || 0))}
                  </p>
                  <p className="text-xs text-slate-500">
                    {customer.total_orders || 0} order(s)
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Order Health">
          <Row label="Paid Orders" value={stats.paidOrders} />
          <Row label="Pending Payments" value={stats.pendingOrders} />
          <Row label="Failed Payments" value={stats.failedOrders} />
          <Row label="Cancelled Orders" value={stats.cancelledOrders} />
        </Panel>

        <Panel title="Delivery Overview">
          <Row label="Delivery Orders" value={deliveryStats.delivery} />
          <Row label="Pickup Orders" value={deliveryStats.pickup} />
          <Row label="Out for Delivery" value={deliveryStats.outForDelivery} />
          <Row label="Delivered" value={deliveryStats.delivered} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Review Health">
          <Row label="Published Reviews" value={stats.publishedReviews} />
          <Row label="Pending Reviews" value={stats.pendingReviews} />
          <Row label="Hidden Reviews" value={stats.hiddenReviews} />
          <Row
            label="Verified Purchases"
            value={stats.verifiedPurchaseReviews}
          />
        </Panel>

        <Panel title="Wishlist Insights">
          {mostWishlistedProducts.length === 0 ? (
            <p className="text-slate-500">No wishlist activity yet.</p>
          ) : (
            <div className="space-y-4">
              {mostWishlistedProducts.map((product) => (
                <div
                  key={product.name}
                  className="border rounded-2xl p-4 flex items-center justify-between"
                >
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="font-bold">{product.count} save(s)</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel title="Top Rated Products">
          {topRatedProducts.length === 0 ? (
            <p className="text-slate-500">No rated products yet.</p>
          ) : (
            <div className="space-y-4">
              {topRatedProducts.map((product) => (
                <div
                  key={product.name}
                  className="border rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-slate-500">
                      {product.reviewCount} review(s)
                    </p>
                  </div>

                  <p className="font-bold">
                    ⭐ {product.averageRating.toFixed(1)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top Products">
          {topProducts.length === 0 ? (
            <p className="text-slate-500">No product sales yet.</p>
          ) : (
            <div className="space-y-4">
              {topProducts.map((product) => (
                <div
                  key={product.name}
                  className="border rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-slate-500">
                      {product.quantity} sold
                    </p>
                  </div>

                  <p className="font-bold">{money(product.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Low Stock Products">
        {stats.lowStockProducts.length === 0 ? (
          <p className="text-green-700 bg-green-50 border border-green-200 rounded-2xl p-4">
            All products have healthy stock levels.
          </p>
        ) : (
          <div className="space-y-4">
            {stats.lowStockProducts.map((product) => (
              <div
                key={product.id}
                className="border rounded-2xl p-4 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-slate-500">
                    Threshold: {product.low_stock_threshold || 5}
                  </p>
                </div>

                <p className="font-bold text-red-600">{product.inventory}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Coupon Usage">
        {couponOrders.length === 0 ? (
          <p className="text-slate-500">No coupon orders yet.</p>
        ) : (
          <div className="space-y-4">
            {couponOrders.slice(0, 10).map((order) => (
              <div
                key={order.id}
                className="border rounded-2xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-sm text-slate-500">{order.coupon_code}</p>
                </div>

                <p className="font-bold text-green-700">
                  -{money(Number(order.discount_amount || 0))}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string | number;
  tone?: "normal" | "danger";
}) {
  return (
    <div
      className={`rounded-2xl shadow p-6 ${tone === "danger" ? "bg-red-50 border border-red-200" : "bg-white"
        }`}
    >
      <p
        className={`text-sm ${tone === "danger" ? "text-red-600" : "text-slate-500"
          }`}
      >
        {label}
      </p>

      <h2
        className={`text-3xl font-bold mt-2 ${tone === "danger" ? "text-red-700" : ""
          }`}
      >
        {value}
      </h2>
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

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-3 last:border-b-0 mb-3 last:mb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}