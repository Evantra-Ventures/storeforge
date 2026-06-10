"use client";

import CustomerNotificationBell from "@/components/customer/CustomerNotificationBell";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  currency: string | null;
  contact_email: string | null;
  support_phone: string | null;
  status?: string | null;
  store_status?: string | null;
  is_published?: boolean | null;
};

type Product = {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  inventory?: number | null;
  status?: string | null;
};

type Variant = {
  id: string;
  name: string;
  option_name: string;
  option_value: string;
  price_adjustment: number;
  image_url: string | null;
  sku: string | null;
  inventory?: number | null;
  status?: string | null;
};

type CartItem = {
  id: string;
  quantity: number;
  product_id: string;
  variant_id: string | null;
  product: Product | Product[] | null;
  variant: Variant | Variant[] | null;
};

type Cart = {
  id: string;
  tenant_id: string;
  user_id: string;
  status: string;
};

type CustomerProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  default_address_id: string | null;
};

type CustomerAddress = {
  id: string;
  label: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  area: string | null;
  city: string | null;
  region: string | null;
  country: string;
  postal_code: string | null;
  delivery_instructions: string | null;
  is_default: boolean;
};

type ShippingZone = {
  id: string;
  name: string;
  fee: number;
  estimated_days: string | null;
};

type LoyaltySettings = {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  points_per_currency: number;
  currency_per_point: number;
  minimum_points_to_redeem: number;
  maximum_points_per_order: number | null;
  reward_name: string;
  reward_currency_label: string;
  allow_points_redemption: boolean;
  status: string;
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

type StorefrontSettings = {
  id: string;
  tenant_id: string;
  theme_preset: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  hero_layout: string;
  product_card_style: string;
  category_style: string;
  button_style: string;
  show_search: boolean;
  show_categories: boolean;
  show_featured_products: boolean;
  show_trust_cards: boolean;
  show_reviews_section: boolean;
  show_loyalty_banner: boolean;
  show_coupon_banner: boolean;
  hero_badge: string | null;
  hero_heading: string | null;
  hero_subheading: string | null;
  featured_section_title: string | null;
  featured_section_subtitle: string | null;
  products_section_title: string | null;
  products_section_subtitle: string | null;
  hero_image_url: string | null;
  promotional_banner_url: string | null;
  status: string;
};

const defaultStorefrontSettings: StorefrontSettings = {
  id: "default",
  tenant_id: "default",
  theme_preset: "modern_dark",
  primary_color: "#020617",
  accent_color: "#2563eb",
  background_color: "#f8fafc",
  text_color: "#0f172a",
  hero_layout: "split",
  product_card_style: "rounded",
  category_style: "pills",
  button_style: "rounded",
  show_search: true,
  show_categories: true,
  show_featured_products: true,
  show_trust_cards: true,
  show_reviews_section: true,
  show_loyalty_banner: true,
  show_coupon_banner: true,
  hero_badge: "Live store · Powered by StoreForge",
  hero_heading: null,
  hero_subheading: null,
  featured_section_title: "Popular right now",
  featured_section_subtitle: "Explore featured products from this store.",
  products_section_title: "Shop products",
  products_section_subtitle: "Browse products, options, and collections.",
  hero_image_url: null,
  promotional_banner_url: null,
  status: "active",
};

function getButtonClass(buttonStyle: string) {
  if (buttonStyle === "pill") return "rounded-full";
  if (buttonStyle === "sharp") return "rounded-none";
  if (buttonStyle === "soft") return "rounded-xl";
  return "rounded-2xl";
}

function getStoreVisibilityStatus(tenant: Tenant | null) {
  if (tenant?.store_status) return tenant.store_status;
  if (tenant?.status) return tenant.status;
  if (tenant?.is_published === false) return "draft";
  return "active";
}

function isStorePublic(status: string) {
  return status === "active" || status === "published";
}

function normalizeCurrency(value?: string | null) {
  const normalized = (value || "GHS").trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return "GHS";
  }

  return normalized;
}

export default function StoreCheckoutPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const slug = params.slug as string;

  const checkoutRedirect = `/store/${slug}/checkout`;
  const loginRedirectUrl = `/login?redirect=${encodeURIComponent(
    checkoutRedirect
  )}`;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [storefrontSettings, setStorefrontSettings] =
    useState<StorefrontSettings>(defaultStorefrontSettings);
  const [cart, setCart] = useState<Cart | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerProfile, setCustomerProfile] =
    useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [loyaltySettings, setLoyaltySettings] =
    useState<LoyaltySettings | null>(null);
  const [loyaltyAccount, setLoyaltyAccount] =
    useState<LoyaltyAccount | null>(null);

  const [storeStatus, setStoreStatus] = useState("active");
  const [canManageStore, setCanManageStore] = useState(false);
  const [storeUnavailable, setStoreUnavailable] = useState(false);

  const [redeemPoints, setRedeemPoints] = useState("");
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [shippingZoneId, setShippingZoneId] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">(
    "delivery"
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("Ghana");
  const [postalCode, setPostalCode] = useState("");
  const [shippingNote, setShippingNote] = useState("");

  const [saveAddress, setSaveAddress] = useState(true);
  const [makeDefaultAddress, setMakeDefaultAddress] = useState(false);

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const currency = normalizeCurrency(tenant?.currency);

  const money = (amount: number) =>
    `${currency} ${Number(amount || 0).toFixed(2)}`;

  const getProduct = (item: CartItem) => {
    if (!item.product) return null;
    return Array.isArray(item.product) ? item.product[0] : item.product;
  };

  const getVariant = (item: CartItem) => {
    if (!item.variant) return null;
    return Array.isArray(item.variant) ? item.variant[0] : item.variant;
  };

  const getItemPrice = (item: CartItem) => {
    const product = getProduct(item);
    const variant = getVariant(item);

    return Number(product?.price || 0) + Number(variant?.price_adjustment || 0);
  };

  const getItemInventory = (item: CartItem) => {
    const product = getProduct(item);
    const variant = getVariant(item);

    return variant
      ? Number(variant.inventory || 0)
      : Number(product?.inventory || 0);
  };

  const selectedShippingZone = useMemo(() => {
    return shippingZones.find((zone) => zone.id === shippingZoneId) || null;
  }, [shippingZones, shippingZoneId]);

  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const unitPrice = getItemPrice(item);
      return acc + unitPrice * Number(item.quantity || 0);
    }, 0);
  }, [cartItems]);

  const shippingFee =
    deliveryMethod === "delivery" ? Number(selectedShippingZone?.fee || 0) : 0;

  const loyaltyPointsBalance = Number(loyaltyAccount?.points_balance || 0);
  const maxRedeemableByBalance = loyaltyPointsBalance;

  const maxRedeemableBySettings =
    loyaltySettings?.maximum_points_per_order !== null &&
    loyaltySettings?.maximum_points_per_order !== undefined
      ? Math.min(
          maxRedeemableByBalance,
          Number(loyaltySettings.maximum_points_per_order)
        )
      : maxRedeemableByBalance;

  const selectedRedeemPoints = useLoyaltyPoints
    ? Math.min(
        Number(redeemPoints || 0),
        maxRedeemableBySettings,
        Math.max(
          0,
          Math.floor(
            (subtotal + shippingFee - 0.01) /
              Math.max(Number(loyaltySettings?.currency_per_point || 0), 0.01)
          )
        )
      )
    : 0;

  const loyaltyDiscount =
    selectedRedeemPoints * Number(loyaltySettings?.currency_per_point || 0);

  const total = Math.max(0, subtotal + shippingFee - loyaltyDiscount);

  const fillFromAddress = (address: CustomerAddress) => {
    setSelectedAddressId(address.id);
    setFullName(address.full_name || customerProfile?.full_name || "");
    setPhone(address.phone || customerProfile?.phone || "");
    setAddressLine1(address.address_line1 || "");
    setAddressLine2(address.address_line2 || "");
    setArea(address.area || "");
    setCity(address.city || "");
    setRegion(address.region || "");
    setCountry(address.country || "Ghana");
    setPostalCode(address.postal_code || "");
    setShippingNote(address.delivery_instructions || "");
  };

  const fetchCheckoutData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setStoreUnavailable(false);
      setCanManageStore(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(loginRedirectUrl);
        return;
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", slug)
        .single();

      if (tenantError || !tenantData) {
        setErrorMessage("Store not found.");
        return;
      }

      const resolvedTenant = tenantData as Tenant;
      const resolvedStoreStatus = getStoreVisibilityStatus(resolvedTenant);

      setTenant({
        ...resolvedTenant,
        currency: normalizeCurrency(resolvedTenant.currency),
      });

      setStoreStatus(resolvedStoreStatus);

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id, role")
        .eq("id", user.id)
        .maybeSingle();

      const userCanManageStore =
        profile?.tenant_id === resolvedTenant.id &&
        ["owner", "store_owner", "admin", "super_admin"].includes(
          profile?.role || ""
        );

      setCanManageStore(userCanManageStore);

      if (!isStorePublic(resolvedStoreStatus) && !userCanManageStore) {
        setStoreUnavailable(true);
        setCart(null);
        setCartItems([]);
        return;
      }

      await supabase.rpc("ensure_storefront_settings", {
        p_tenant_id: resolvedTenant.id,
      });

      const { data: storefrontSettingsData } = await supabase
        .from("storefront_settings")
        .select("*")
        .eq("tenant_id", resolvedTenant.id)
        .eq("status", "active")
        .maybeSingle();

      setStorefrontSettings({
        ...defaultStorefrontSettings,
        ...(storefrontSettingsData || {}),
      });

      const { data: cartData, error: cartError } = await supabase
        .from("carts")
        .select("*")
        .eq("tenant_id", resolvedTenant.id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (cartError) {
        setErrorMessage(cartError.message);
        return;
      }

      if (!cartData) {
        setCart(null);
        setCartItems([]);
        return;
      }

      setCart(cartData);

      const { data: cartItemsData, error: cartItemsError } = await supabase
        .from("cart_items")
        .select(`
          id,
          quantity,
          product_id,
          variant_id,
          product:products (
            id,
            name,
            image_url,
            price,
            inventory,
            status
          ),
          variant:product_variants (
            id,
            name,
            option_name,
            option_value,
            price_adjustment,
            image_url,
            sku,
            inventory,
            status
          )
        `)
        .eq("cart_id", cartData.id);

      if (cartItemsError) {
        setErrorMessage(cartItemsError.message);
        return;
      }

      const safeCartItems = (cartItemsData || []).filter((item: any) => {
        const product = Array.isArray(item.product)
          ? item.product[0]
          : item.product;

        const variant = item.variant
          ? Array.isArray(item.variant)
            ? item.variant[0]
            : item.variant
          : null;

        if (!product || product.status !== "active") return false;
        if (variant && variant.status !== "active") return false;

        return true;
      });

      setCartItems(safeCartItems);

      const { data: ensuredProfileId } = await supabase.rpc(
        "ensure_customer_profile",
        {
          p_tenant_id: resolvedTenant.id,
          p_user_id: user.id,
          p_full_name:
            user.user_metadata?.full_name || user.user_metadata?.name || null,
          p_email: user.email || null,
          p_phone: user.phone || null,
        }
      );

      if (ensuredProfileId) {
        const { data: profileData } = await supabase
          .from("customer_profiles")
          .select("id,full_name,email,phone,default_address_id")
          .eq("id", ensuredProfileId)
          .maybeSingle();

        if (profileData) {
          setCustomerProfile(profileData);
          setFullName(profileData.full_name || "");
          setEmail(profileData.email || user.email || "");
          setPhone(profileData.phone || user.phone || "");

          await supabase.rpc("ensure_loyalty_settings", {
            p_tenant_id: resolvedTenant.id,
          });

          const { data: settingsData } = await supabase
            .from("loyalty_settings")
            .select(`
              id,
              tenant_id,
              is_enabled,
              points_per_currency,
              currency_per_point,
              minimum_points_to_redeem,
              maximum_points_per_order,
              reward_name,
              reward_currency_label,
              allow_points_redemption,
              status
            `)
            .eq("tenant_id", resolvedTenant.id)
            .maybeSingle();

          setLoyaltySettings(settingsData || null);

          const { data: loyaltyAccountId } = await supabase.rpc(
            "ensure_customer_loyalty_account",
            {
              p_tenant_id: resolvedTenant.id,
              p_customer_profile_id: profileData.id,
              p_user_id: user.id,
            }
          );

          if (loyaltyAccountId) {
            const { data: accountData } = await supabase
              .from("customer_loyalty_accounts")
              .select("*")
              .eq("id", loyaltyAccountId)
              .maybeSingle();

            setLoyaltyAccount(accountData || null);
          }
        }

        const { data: addressData } = await supabase
          .from("customer_addresses")
          .select("*")
          .eq("tenant_id", resolvedTenant.id)
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        const loadedAddresses = addressData || [];
        setAddresses(loadedAddresses);

        const defaultAddress =
          loadedAddresses.find((address) => address.is_default) ||
          loadedAddresses.find(
            (address) => address.id === profileData?.default_address_id
          );

        if (defaultAddress) {
          fillFromAddress(defaultAddress);
        }
      }

      const { data: zonesData } = await supabase
        .from("shipping_zones")
        .select("id,name,fee,estimated_days")
        .eq("tenant_id", resolvedTenant.id)
        .eq("status", "active")
        .order("fee", { ascending: true });

      setShippingZones(zonesData || []);

      if (zonesData && zonesData.length > 0) {
        setShippingZoneId(zonesData[0].id);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load checkout.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const validateCheckout = () => {
    if (!isStorePublic(storeStatus)) {
      setErrorMessage("This store is not accepting checkout right now.");
      return false;
    }

    if (!tenant || !cart) {
      setErrorMessage("Cart not found.");
      return false;
    }

    if (cartItems.length === 0) {
      setErrorMessage("Your cart is empty.");
      return false;
    }

    for (const item of cartItems) {
      const product = getProduct(item);
      const variant = getVariant(item);
      const itemInventory = getItemInventory(item);

      if (!product || product.status !== "active") {
        setErrorMessage("One or more products in your cart are unavailable.");
        return false;
      }

      if (variant && variant.status !== "active") {
        setErrorMessage("One or more selected options are unavailable.");
        return false;
      }

      if (itemInventory > 0 && Number(item.quantity || 0) > itemInventory) {
        setErrorMessage(`${product.name} does not have enough stock.`);
        return false;
      }
    }

    if (!fullName.trim()) {
      setErrorMessage("Full name is required.");
      return false;
    }

    if (!email.trim()) {
      setErrorMessage("Email is required.");
      return false;
    }

    if (!phone.trim()) {
      setErrorMessage("Phone number is required.");
      return false;
    }

    if (deliveryMethod === "delivery") {
      if (!addressLine1.trim()) {
        setErrorMessage("Delivery address is required.");
        return false;
      }

      if (!city.trim()) {
        setErrorMessage("City is required.");
        return false;
      }

      if (!region.trim()) {
        setErrorMessage("Region is required.");
        return false;
      }

      if (shippingZones.length > 0 && !shippingZoneId) {
        setErrorMessage("Please select a delivery zone.");
        return false;
      }
    }

    if (useLoyaltyPoints) {
      if (
        !loyaltySettings?.is_enabled ||
        !loyaltySettings.allow_points_redemption
      ) {
        setErrorMessage("Loyalty redemption is not available.");
        return false;
      }

      const points = Number(redeemPoints || 0);

      if (!points || points <= 0) {
        setErrorMessage("Enter loyalty points to redeem.");
        return false;
      }

      if (points > loyaltyPointsBalance) {
        setErrorMessage("You do not have enough loyalty points.");
        return false;
      }

      if (points < Number(loyaltySettings.minimum_points_to_redeem || 0)) {
        setErrorMessage(
          `Minimum redemption is ${Number(
            loyaltySettings.minimum_points_to_redeem || 0
          ).toLocaleString()} points.`
        );
        return false;
      }

      if (
        loyaltySettings.maximum_points_per_order !== null &&
        loyaltySettings.maximum_points_per_order !== undefined &&
        points > Number(loyaltySettings.maximum_points_per_order)
      ) {
        setErrorMessage(
          `Maximum redemption per order is ${Number(
            loyaltySettings.maximum_points_per_order
          ).toLocaleString()} points.`
        );
        return false;
      }

      if (selectedRedeemPoints <= 0) {
        setErrorMessage(
          "The selected loyalty points cannot be applied to this order."
        );
        return false;
      }

      if (points > selectedRedeemPoints) {
        setRedeemPoints(String(selectedRedeemPoints));
        setErrorMessage(
          `You can only redeem ${selectedRedeemPoints.toLocaleString()} points for this order. I have adjusted the value. Click Pay Now again to continue.`
        );
        return false;
      }
    }

    if (total <= 0) {
      setErrorMessage(
        "This order total is 0 after discounts. Online payment cannot be initialized for a zero amount."
      );
      return false;
    }

    return true;
  };

  const saveCheckoutAddressIfNeeded = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (
      !user ||
      !tenant ||
      !customerProfile ||
      !saveAddress ||
      deliveryMethod !== "delivery" ||
      selectedAddressId
    ) {
      return null;
    }

    const { data, error } = await supabase
      .from("customer_addresses")
      .insert({
        tenant_id: tenant.id,
        customer_profile_id: customerProfile.id,
        user_id: user.id,
        label: "Home",
        full_name: fullName,
        phone,
        address_line1: addressLine1,
        address_line2: addressLine2 || null,
        area: area || null,
        city,
        region,
        country: country || "Ghana",
        postal_code: postalCode || null,
        delivery_instructions: shippingNote || null,
        is_default: makeDefaultAddress,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to save address:", error);
      return null;
    }

    if (makeDefaultAddress && data?.id) {
      await supabase.rpc("set_default_customer_address", {
        p_address_id: data.id,
        p_user_id: user.id,
      });
    }

    return data?.id || null;
  };

  const handlePayNow = async () => {
    try {
      setPaying(true);
      setErrorMessage("");

      if (!validateCheckout() || !tenant || !cart) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(loginRedirectUrl);
        return;
      }

      const latestStoreStatus = getStoreVisibilityStatus(tenant);

      if (!isStorePublic(latestStoreStatus)) {
        setErrorMessage("This store is not accepting checkout right now.");
        return;
      }

      const orderCurrency = normalizeCurrency(tenant.currency);
      const savedAddressId = await saveCheckoutAddressIfNeeded();

      if (customerProfile) {
        await supabase
          .from("customer_profiles")
          .update({
            full_name: fullName,
            email,
            phone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", customerProfile.id)
          .eq("user_id", user.id);
      }

      const finalSubtotal = Number(subtotal.toFixed(2));
      const finalShippingFee = Number(shippingFee.toFixed(2));
      const finalDiscountAmount = Number(loyaltyDiscount.toFixed(2));
      const finalTotalAmount = Number(total.toFixed(2));

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          tenant_id: tenant.id,
          customer_id: user.id,
          customer_email: email,
          customer_name: fullName || "Customer",
          currency: orderCurrency,

          subtotal_amount: finalSubtotal,
          discount_amount: finalDiscountAmount,

          delivery_method: deliveryMethod,
          shipping_zone_id:
            deliveryMethod === "delivery" ? shippingZoneId || null : null,

          customer_address_id: selectedAddressId || savedAddressId || null,

          shipping_full_name: fullName,
          shipping_phone: phone,
          shipping_address:
            deliveryMethod === "delivery" ? addressLine1 : null,
          shipping_address2:
            deliveryMethod === "delivery" ? addressLine2 || null : null,
          shipping_area: deliveryMethod === "delivery" ? area || null : null,
          shipping_city: deliveryMethod === "delivery" ? city || null : null,
          shipping_region:
            deliveryMethod === "delivery" ? region || null : null,
          shipping_country:
            deliveryMethod === "delivery" ? country || "Ghana" : null,
          shipping_postal_code:
            deliveryMethod === "delivery" ? postalCode || null : null,
          shipping_note: shippingNote || null,
          shipping_fee: finalShippingFee,

          total_amount: finalTotalAmount,
          status: "pending",
          payment_status: "pending",
        })
        .select("*")
        .single();

      if (orderError || !order) {
        setErrorMessage(orderError?.message || "Failed to create order.");
        return;
      }

      const orderItems = cartItems.map((item) => {
        const product = getProduct(item);
        const unitPrice = getItemPrice(item);

        return {
          order_id: order.id,
          product_id: product?.id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          price: Number(unitPrice.toFixed(2)),
        };
      });

      const { error: orderItemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (orderItemsError) {
        setErrorMessage(
          orderItemsError.message || "Failed to create order items."
        );
        return;
      }

      if (useLoyaltyPoints && selectedRedeemPoints > 0) {
        const { error: loyaltyError } = await supabase.rpc(
          "redeem_loyalty_points_for_order",
          {
            p_tenant_id: tenant.id,
            p_user_id: user.id,
            p_order_id: order.id,
            p_points: selectedRedeemPoints,
          }
        );

        if (loyaltyError) {
          setErrorMessage(loyaltyError.message);
          return;
        }
      }

      const paymentResponse = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
        }),
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok) {
        setErrorMessage(paymentData.error || "Payment initialization failed.");
        return;
      }

      const authorizationUrl =
        paymentData.authorizationUrl ||
        paymentData.authorization_url ||
        paymentData.data?.authorization_url;

      if (!authorizationUrl) {
        setErrorMessage("Payment authorization URL not returned.");
        return;
      }

      window.location.href = authorizationUrl;
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to continue to payment.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-slate-500">Loading secure checkout...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Store not found</h1>
          <p className="mt-2 text-slate-500">
            This checkout page could not find the store.
          </p>
        </div>
      </div>
    );
  }

  if (storeUnavailable) {
    return <StoreUnavailable tenant={tenant} status={storeStatus} />;
  }

  if (!cart || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CheckoutHeader tenant={tenant} settings={storefrontSettings} />

        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-white">
              🛒
            </div>

            <h1 className="text-3xl font-bold">Your cart is empty</h1>

            <p className="mt-3 text-slate-500">
              Add products to your cart before checkout.
            </p>

            <a
              href={`/store/${tenant.slug}`}
              className="mt-6 inline-block rounded-2xl bg-slate-950 px-6 py-3 text-white"
            >
              Back to Store
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {canManageStore && !isStorePublic(storeStatus) && (
        <div className="border-b border-yellow-200 bg-yellow-50 px-6 py-3 text-center text-sm text-yellow-800">
          Preview mode: this store is currently{" "}
          <strong className="capitalize">{storeStatus}</strong>. Checkout is
          disabled until the store is published/active.
        </div>
      )}

      <CheckoutHeader tenant={tenant} settings={storefrontSettings} />

      <main className="mx-auto max-w-7xl px-6 py-8 lg:py-12">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a
              href={`/store/${tenant.slug}/cart`}
              className="text-sm font-medium text-slate-500 hover:text-slate-950"
            >
              ← Back to cart
            </a>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">
              Secure checkout
            </h1>

            <p className="mt-2 text-slate-500">
              Confirm your details, choose delivery, redeem rewards, and
              continue to secure payment.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            🔒 100% secure checkout powered by Paystack
          </div>
        </div>

        {!isStorePublic(storeStatus) && (
          <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
            This store is in preview mode. Checkout is disabled until the store
            is active.
          </div>
        )}

        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StepPill number="1" title="Information" active />
            <StepPill number="2" title="Shipping" active />
            <StepPill number="3" title="Payment" />
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <section className="space-y-6 lg:col-span-2">
            <CheckoutPanel
              eyebrow="Customer information"
              title="Tell us who is receiving the order"
              description="We’ll use this information for your order confirmation, receipt, and delivery updates."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Full name">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    className="field-input"
                  />
                </Field>

                <Field label="Email address">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    className="field-input"
                  />
                </Field>

                <Field label="Phone number">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone"
                    className="field-input"
                  />
                </Field>
              </div>
            </CheckoutPanel>

            <CheckoutPanel
              eyebrow="Shipping options"
              title="Choose how you want to receive your order"
              description="Select delivery to your address or pickup from the store if available."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <MethodCard
                  title="Deliver to me"
                  description="Get this order delivered to your address."
                  selected={deliveryMethod === "delivery"}
                  onClick={() => setDeliveryMethod("delivery")}
                />

                <MethodCard
                  title="Pickup in-store"
                  description="Pick up from the merchant’s location if available."
                  selected={deliveryMethod === "pickup"}
                  onClick={() => setDeliveryMethod("pickup")}
                />
              </div>

              {deliveryMethod === "delivery" && shippingZones.length > 0 && (
                <div className="mt-5">
                  <Field label="Shipping zone">
                    <select
                      value={shippingZoneId}
                      onChange={(e) => setShippingZoneId(e.target.value)}
                      className="field-input"
                    >
                      {shippingZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name} — {money(Number(zone.fee || 0))}
                          {zone.estimated_days
                            ? ` · ${zone.estimated_days}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
            </CheckoutPanel>

            {deliveryMethod === "delivery" && (
              <CheckoutPanel
                eyebrow="Delivery address"
                title="Where should we deliver?"
                description="Use a saved address or enter a new one for this order."
                action={
                  <a
                    href={`/customer/profile?store=${tenant.slug}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Manage addresses
                  </a>
                }
              >
                {addresses.length > 0 && (
                  <div className="mb-5">
                    <Field label="Saved address">
                      <select
                        value={selectedAddressId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedAddressId(id);

                          const address = addresses.find(
                            (item) => item.id === id
                          );

                          if (address) {
                            fillFromAddress(address);
                          }
                        }}
                        className="field-input"
                      >
                        <option value="">Use a new address</option>

                        {addresses.map((address) => (
                          <option key={address.id} value={address.id}>
                            {address.label}
                            {address.is_default ? " · Default" : ""} —{" "}
                            {[address.area, address.city, address.region]
                              .filter(Boolean)
                              .join(", ")}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Address line 1">
                    <input
                      value={addressLine1}
                      onChange={(e) => {
                        setAddressLine1(e.target.value);
                        setSelectedAddressId("");
                      }}
                      placeholder="Street address"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Address line 2 optional">
                    <input
                      value={addressLine2}
                      onChange={(e) => {
                        setAddressLine2(e.target.value);
                        setSelectedAddressId("");
                      }}
                      placeholder="Apartment, suite, etc."
                      className="field-input"
                    />
                  </Field>

                  <Field label="Area">
                    <input
                      value={area}
                      onChange={(e) => {
                        setArea(e.target.value);
                        setSelectedAddressId("");
                      }}
                      placeholder="Area"
                      className="field-input"
                    />
                  </Field>

                  <Field label="City">
                    <input
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setSelectedAddressId("");
                      }}
                      placeholder="City"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Region">
                    <input
                      value={region}
                      onChange={(e) => {
                        setRegion(e.target.value);
                        setSelectedAddressId("");
                      }}
                      placeholder="Region"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Country">
                    <input
                      value={country}
                      onChange={(e) => {
                        setCountry(e.target.value);
                        setSelectedAddressId("");
                      }}
                      placeholder="Country"
                      className="field-input"
                    />
                  </Field>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Postal code optional">
                    <input
                      value={postalCode}
                      onChange={(e) => {
                        setPostalCode(e.target.value);
                        setSelectedAddressId("");
                      }}
                      placeholder="Postal code"
                      className="field-input"
                    />
                  </Field>

                  <Field label="Delivery note optional">
                    <input
                      value={shippingNote}
                      onChange={(e) => setShippingNote(e.target.value)}
                      placeholder="Example: Call when outside"
                      className="field-input"
                    />
                  </Field>
                </div>

                {!selectedAddressId && (
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium">Save this address</p>
                        <p className="text-xs text-slate-500">
                          Use this address faster next time.
                        </p>
                      </div>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={makeDefaultAddress}
                        onChange={(e) =>
                          setMakeDefaultAddress(e.target.checked)
                        }
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium">Make default</p>
                        <p className="text-xs text-slate-500">
                          Automatically use this address at checkout.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </CheckoutPanel>
            )}
          </section>

          <OrderSummary
            cartItems={cartItems}
            money={money}
            getProduct={getProduct}
            getVariant={getVariant}
            getItemPrice={getItemPrice}
            subtotal={subtotal}
            shippingFee={shippingFee}
            total={total}
            selectedRedeemPoints={selectedRedeemPoints}
            loyaltyDiscount={loyaltyDiscount}
            loyaltySettings={loyaltySettings}
            loyaltyPointsBalance={loyaltyPointsBalance}
            useLoyaltyPoints={useLoyaltyPoints}
            setUseLoyaltyPoints={setUseLoyaltyPoints}
            redeemPoints={redeemPoints}
            setRedeemPoints={setRedeemPoints}
            maxRedeemableBySettings={maxRedeemableBySettings}
            handlePayNow={handlePayNow}
            paying={paying}
            storeIsPublic={isStorePublic(storeStatus)}
            tenantSlug={tenant.slug}
          />
        </div>
      </main>
    </div>
  );
}

function StoreUnavailable({
  tenant,
  status,
}: {
  tenant: Tenant;
  status: string;
}) {
  const title =
    status === "paused"
      ? "This store is temporarily paused"
      : status === "suspended"
      ? "This store is currently unavailable"
      : "This store is not live yet";

  const message =
    status === "paused"
      ? "The merchant has temporarily paused this storefront. Checkout is not available right now."
      : status === "suspended"
      ? "This storefront cannot accept checkout at the moment."
      : "The merchant is still preparing this storefront. Checkout will be available when the store goes live.";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-3xl font-bold text-slate-950">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-full w-full rounded-3xl object-cover"
              />
            ) : (
              tenant.name.slice(0, 1)
            )}
          </div>

          <p className="text-sm font-semibold uppercase tracking-wide text-sky-300">
            StoreForge checkout
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight">{title}</h1>

          <p className="mx-auto mt-4 max-w-xl text-slate-300">{message}</p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="/"
              className="rounded-2xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
            >
              Back to StoreForge
            </a>

            <a
              href={`/store/${tenant.slug}`}
              className="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              Visit store
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

function CheckoutHeader({
  tenant,
  settings,
}: {
  tenant: Tenant;
  settings: StorefrontSettings;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <a href={`/store/${tenant.slug}`} className="flex items-center gap-4">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-12 w-12 rounded-2xl border object-cover"
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
              style={{ backgroundColor: settings.primary_color }}
            >
              {tenant.name.slice(0, 1)}
            </div>
          )}

          <div>
            <p className="text-xl font-bold text-slate-950">{tenant.name}</p>
            <p className="text-xs text-slate-500">Secure checkout</p>
          </div>
        </a>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href={`/store/${tenant.slug}`}
            className="text-sm text-slate-500 hover:text-black"
          >
            Store
          </a>

          <a
            href={`/customer/profile?store=${tenant.slug}`}
            className="text-sm text-slate-500 hover:text-black"
          >
            My Profile
          </a>

          <a
            href="/my-orders"
            className="text-sm text-slate-500 hover:text-black"
          >
            My Orders
          </a>

          <a
            href="/wishlist"
            className="text-sm text-slate-500 hover:text-black"
          >
            Wishlist
          </a>

          <a
            href={`/customer/loyalty?store=${tenant.slug}`}
            className="text-sm text-slate-500 hover:text-black"
          >
            My Rewards
          </a>

          <a
            href={`/customer/notifications?store=${tenant.slug}`}
            className="text-sm text-slate-500 hover:text-black"
          >
            Notifications
          </a>

          <CustomerNotificationBell tenantId={tenant.id} />

          <a
            href={`/store/${tenant.slug}/cart`}
            className={`${getButtonClass(
              settings.button_style
            )} px-4 py-2 text-sm text-white`}
            style={{ backgroundColor: settings.primary_color }}
          >
            Cart
          </a>
        </div>
      </div>
    </header>
  );
}

function CheckoutPanel({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}

function StepPill({
  number,
  title,
  active,
}: {
  number: string;
  title: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-4 ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
          active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"
        }`}
      >
        {number}
      </span>
      <span className="font-semibold">{title}</span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function MethodCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition ${
        selected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full border ${
            selected ? "border-blue-600 bg-blue-600" : "border-slate-300"
          }`}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-white" />}
        </span>

        <div>
          <p className="font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

function OrderSummary({
  cartItems,
  money,
  getProduct,
  getVariant,
  getItemPrice,
  subtotal,
  shippingFee,
  total,
  selectedRedeemPoints,
  loyaltyDiscount,
  loyaltySettings,
  loyaltyPointsBalance,
  useLoyaltyPoints,
  setUseLoyaltyPoints,
  redeemPoints,
  setRedeemPoints,
  maxRedeemableBySettings,
  handlePayNow,
  paying,
  storeIsPublic,
  tenantSlug,
}: {
  cartItems: CartItem[];
  money: (amount: number) => string;
  getProduct: (item: CartItem) => Product | null;
  getVariant: (item: CartItem) => Variant | null;
  getItemPrice: (item: CartItem) => number;
  subtotal: number;
  shippingFee: number;
  total: number;
  selectedRedeemPoints: number;
  loyaltyDiscount: number;
  loyaltySettings: LoyaltySettings | null;
  loyaltyPointsBalance: number;
  useLoyaltyPoints: boolean;
  setUseLoyaltyPoints: (value: boolean) => void;
  redeemPoints: string;
  setRedeemPoints: (value: string) => void;
  maxRedeemableBySettings: number;
  handlePayNow: () => void;
  paying: boolean;
  storeIsPublic: boolean;
  tenantSlug: string;
}) {
  return (
    <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Order summary</h2>
          <p className="mt-1 text-sm text-slate-500">
            {cartItems.length} item(s) in your cart
          </p>
        </div>

        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
          Secure
        </span>
      </div>

      <div className="space-y-4">
        {cartItems.map((item) => {
          const product = getProduct(item);
          const variant = getVariant(item);
          const imageUrl = variant?.image_url || product?.image_url;
          const unitPrice = getItemPrice(item);

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b border-slate-100 pb-4"
            >
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product?.name || "Product"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-400">No image</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {product?.name || "Product"}
                </p>

                {variant && (
                  <p className="mt-1 text-xs text-blue-700">
                    {variant.option_name}: {variant.option_value}
                  </p>
                )}

                <p className="mt-1 text-xs text-slate-500">
                  Qty {item.quantity} × {money(unitPrice)}
                </p>
              </div>

              <p className="text-sm font-bold text-slate-950">
                {money(unitPrice * Number(item.quantity || 0))}
              </p>
            </div>
          );
        })}
      </div>

      {loyaltySettings?.is_enabled && loyaltySettings.allow_points_redemption && (
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-950">
                {loyaltySettings.reward_name || "Loyalty Points"}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Balance: {loyaltyPointsBalance.toLocaleString()}{" "}
                {loyaltySettings.reward_currency_label || "points"}
              </p>
            </div>

            <a
              href={`/customer/loyalty?store=${tenantSlug}`}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              My Rewards
            </a>
          </div>

          <label className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              checked={useLoyaltyPoints}
              onChange={(e) => {
                setUseLoyaltyPoints(e.target.checked);

                if (!e.target.checked) {
                  setRedeemPoints("");
                }
              }}
              className="mt-1"
            />

            <div>
              <p className="text-sm font-medium text-slate-950">
                Redeem points on this order
              </p>
              <p className="text-xs text-slate-500">
                Minimum:{" "}
                {Number(
                  loyaltySettings.minimum_points_to_redeem || 0
                ).toLocaleString()}{" "}
                points
              </p>
            </div>
          </label>

          {useLoyaltyPoints && (
            <div className="mt-4 space-y-2">
              <input
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
                type="number"
                min="0"
                max={maxRedeemableBySettings}
                placeholder="Points to redeem"
                className="field-input bg-white"
              />

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Max usable: {maxRedeemableBySettings.toLocaleString()} points
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setRedeemPoints(String(maxRedeemableBySettings))
                  }
                  className="font-medium text-blue-700 hover:underline"
                >
                  Use max
                </button>
              </div>

              {selectedRedeemPoints > 0 && (
                <p className="text-sm font-medium text-green-700">
                  You will save {money(loyaltyDiscount)} using{" "}
                  {selectedRedeemPoints.toLocaleString()} points.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 space-y-3 text-sm">
        <SummaryRow label="Subtotal" value={money(subtotal)} />
        <SummaryRow label="Shipping" value={money(shippingFee)} />

        {selectedRedeemPoints > 0 && (
          <SummaryRow
            label="Loyalty discount"
            value={`-${money(loyaltyDiscount)}`}
            success
          />
        )}

        <div className="flex justify-between border-t border-slate-200 pt-4 text-base">
          <span className="font-semibold text-slate-950">Total</span>
          <span className="text-xl font-bold text-slate-950">
            {money(total)}
          </span>
        </div>
      </div>

      <button
        onClick={handlePayNow}
        disabled={paying || cartItems.length === 0 || !storeIsPublic}
        className="mt-6 w-full rounded-2xl bg-blue-600 py-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {paying ? "Redirecting to payment..." : "Proceed to payment →"}
      </button>

      <p className="mt-4 text-center text-xs text-slate-500">
        🔒 Payment is securely processed by Paystack.
      </p>
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${
        success ? "text-green-700" : "text-slate-600"
      }`}
    >
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}