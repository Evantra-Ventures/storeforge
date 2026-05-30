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
};

type Product = {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
};

type Variant = {
  id: string;
  name: string;
  option_name: string;
  option_value: string;
  price_adjustment: number;
  image_url: string | null;
  sku: string | null;
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

export default function StoreCheckoutPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const slug = params.slug as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
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

  const currency = tenant?.currency || "GHS";

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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("id,name,slug,logo_url,currency,contact_email,support_phone")
        .eq("slug", slug)
        .single();

      if (tenantError || !tenantData) {
        setErrorMessage("Store not found.");
        return;
      }

      setTenant(tenantData);

      const { data: cartData, error: cartError } = await supabase
        .from("carts")
        .select("*")
        .eq("tenant_id", tenantData.id)
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
            price
          ),
          variant:product_variants (
            id,
            name,
            option_name,
            option_value,
            price_adjustment,
            image_url,
            sku
          )
        `)
        .eq("cart_id", cartData.id);

      if (cartItemsError) {
        setErrorMessage(cartItemsError.message);
        return;
      }

      setCartItems(cartItemsData || []);

      const { data: ensuredProfileId } = await supabase.rpc(
        "ensure_customer_profile",
        {
          p_tenant_id: tenantData.id,
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
            p_tenant_id: tenantData.id,
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
            .eq("tenant_id", tenantData.id)
            .maybeSingle();

          setLoyaltySettings(settingsData || null);

          const { data: loyaltyAccountId } = await supabase.rpc(
            "ensure_customer_loyalty_account",
            {
              p_tenant_id: tenantData.id,
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
          .eq("tenant_id", tenantData.id)
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
        .eq("tenant_id", tenantData.id)
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
    if (!tenant || !cart) {
      setErrorMessage("Cart not found.");
      return false;
    }

    if (cartItems.length === 0) {
      setErrorMessage("Your cart is empty.");
      return false;
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
        router.push("/login");
        return;
      }

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

      const preLoyaltyTotal = subtotal + shippingFee;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          tenant_id: tenant.id,
          customer_id: user.id,
          customer_email: email,
          customer_name: fullName || "Customer",

          subtotal_amount: Number(subtotal.toFixed(2)),
          discount_amount: 0,

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
          shipping_fee: Number(shippingFee.toFixed(2)),

          total_amount: Number(preLoyaltyTotal.toFixed(2)),
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading checkout...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold">Store not found</h1>
          <p className="text-slate-500 mt-2">
            This checkout page could not find the store.
          </p>
        </div>
      </div>
    );
  }

  if (!cart || cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CheckoutHeader tenant={tenant} />

        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="bg-white rounded-3xl shadow p-10 text-center">
            <h1 className="text-3xl font-bold">Your cart is empty</h1>
            <p className="text-slate-500 mt-3">
              Add products to your cart before checkout.
            </p>

            <a
              href={`/store/${tenant.slug}`}
              className="inline-block bg-black text-white px-6 py-3 rounded-xl mt-6"
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
      <CheckoutHeader tenant={tenant} />

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-4 flex-wrap">
          <a
            href={`/store/${tenant.slug}/cart`}
            className="text-sm text-slate-500 hover:text-black"
          >
            ← Back to Cart
          </a>

          <a
            href="/customer/loyalty"
            className="text-sm text-slate-500 hover:text-black"
          >
            My Rewards
          </a>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 space-y-6">
            {errorMessage && (
              <div className="bg-red-100 text-red-700 p-4 rounded-xl">
                {errorMessage}
              </div>
            )}

            <div className="bg-white rounded-3xl shadow p-6 space-y-5">
              <div>
                <h1 className="text-2xl font-bold">Checkout</h1>
                <p className="text-slate-500 mt-1">
                  Confirm your details before continuing to Paystack.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="border rounded-xl p-3"
                />

                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  className="border rounded-xl p-3"
                />

                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="border rounded-xl p-3"
                />
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow p-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">Delivery Method</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Choose how you want to receive your order.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="border rounded-2xl p-4 flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={deliveryMethod === "delivery"}
                    onChange={() => setDeliveryMethod("delivery")}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-semibold">Delivery</p>
                    <p className="text-xs text-slate-500">
                      Ship this order to your address.
                    </p>
                  </div>
                </label>

                <label className="border rounded-2xl p-4 flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    checked={deliveryMethod === "pickup"}
                    onChange={() => setDeliveryMethod("pickup")}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-semibold">Pickup</p>
                    <p className="text-xs text-slate-500">
                      Pick up from the store if available.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {deliveryMethod === "delivery" && (
              <div className="bg-white rounded-3xl shadow p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Delivery Address</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Use a saved address or enter a new one.
                    </p>
                  </div>

                  <a
                    href="/customer/profile"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Manage addresses
                  </a>
                </div>

                {addresses.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Saved Address
                    </label>

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
                      className="w-full border rounded-xl p-3"
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
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    value={addressLine1}
                    onChange={(e) => {
                      setAddressLine1(e.target.value);
                      setSelectedAddressId("");
                    }}
                    placeholder="Address line 1"
                    className="border rounded-xl p-3"
                  />

                  <input
                    value={addressLine2}
                    onChange={(e) => {
                      setAddressLine2(e.target.value);
                      setSelectedAddressId("");
                    }}
                    placeholder="Address line 2 optional"
                    className="border rounded-xl p-3"
                  />

                  <input
                    value={area}
                    onChange={(e) => {
                      setArea(e.target.value);
                      setSelectedAddressId("");
                    }}
                    placeholder="Area"
                    className="border rounded-xl p-3"
                  />

                  <input
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setSelectedAddressId("");
                    }}
                    placeholder="City"
                    className="border rounded-xl p-3"
                  />

                  <input
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value);
                      setSelectedAddressId("");
                    }}
                    placeholder="Region"
                    className="border rounded-xl p-3"
                  />

                  <input
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      setSelectedAddressId("");
                    }}
                    placeholder="Country"
                    className="border rounded-xl p-3"
                  />
                </div>

                <input
                  value={postalCode}
                  onChange={(e) => {
                    setPostalCode(e.target.value);
                    setSelectedAddressId("");
                  }}
                  placeholder="Postal code optional"
                  className="border rounded-xl p-3 w-full"
                />

                <textarea
                  value={shippingNote}
                  onChange={(e) => setShippingNote(e.target.value)}
                  placeholder="Delivery note optional"
                  className="border rounded-xl p-3 w-full min-h-[100px]"
                />

                {!selectedAddressId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="border rounded-xl p-4 flex items-start gap-3">
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

                    <label className="border rounded-xl p-4 flex items-start gap-3">
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

                {shippingZones.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Delivery Zone
                    </label>

                    <select
                      value={shippingZoneId}
                      onChange={(e) => setShippingZoneId(e.target.value)}
                      className="w-full border rounded-xl p-3"
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
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="bg-white rounded-3xl shadow p-6 h-fit lg:sticky lg:top-8">
            <h2 className="text-xl font-semibold mb-5">Order Summary</h2>

            <div className="space-y-4">
              {cartItems.map((item) => {
                const product = getProduct(item);
                const variant = getVariant(item);
                const imageUrl = variant?.image_url || product?.image_url;
                const unitPrice = getItemPrice(item);

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 border-b pb-4"
                  >
                    <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product?.name || "Product"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">
                          No image
                        </span>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {product?.name || "Product"}
                      </p>

                      {variant && (
                        <p className="text-xs text-purple-700 mt-1">
                          {variant.option_name}: {variant.option_value}
                        </p>
                      )}

                      <p className="text-xs text-slate-500 mt-1">
                        Qty {item.quantity} × {money(unitPrice)}
                      </p>
                    </div>

                    <p className="font-semibold text-sm">
                      {money(unitPrice * Number(item.quantity || 0))}
                    </p>
                  </div>
                );
              })}
            </div>

            {loyaltySettings?.is_enabled &&
              loyaltySettings.allow_points_redemption && (
                <div className="mt-6 border rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">
                        {loyaltySettings.reward_name || "Loyalty Points"}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Balance: {loyaltyPointsBalance.toLocaleString()}{" "}
                        {loyaltySettings.reward_currency_label || "points"}
                      </p>
                    </div>

                    <a
                      href="/customer/loyalty"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      My Rewards
                    </a>
                  </div>

                  <label className="flex items-start gap-3">
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
                      <p className="text-sm font-medium">
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
                    <div className="space-y-2">
                      <input
                        value={redeemPoints}
                        onChange={(e) => setRedeemPoints(e.target.value)}
                        type="number"
                        min="0"
                        max={maxRedeemableBySettings}
                        placeholder="Points to redeem"
                        className="border rounded-xl p-3 w-full"
                      />

                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Max usable:{" "}
                          {maxRedeemableBySettings.toLocaleString()} points
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setRedeemPoints(String(maxRedeemableBySettings))
                          }
                          className="text-blue-600 hover:underline"
                        >
                          Use max
                        </button>
                      </div>

                      {selectedRedeemPoints > 0 && (
                        <p className="text-sm text-green-700">
                          You will save {money(loyaltyDiscount)} using{" "}
                          {selectedRedeemPoints.toLocaleString()} points.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

            <div className="space-y-3 mt-6 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">{money(subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Shipping</span>
                <span className="font-medium">{money(shippingFee)}</span>
              </div>

              {selectedRedeemPoints > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Loyalty Discount</span>
                  <span className="font-medium">
                    -{money(loyaltyDiscount)}
                  </span>
                </div>
              )}

              <div className="border-t pt-4 flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{money(total)}</span>
              </div>
            </div>

            <button
              onClick={handlePayNow}
              disabled={paying || cartItems.length === 0}
              className="w-full bg-black text-white py-4 rounded-2xl font-medium mt-6 hover:opacity-90 disabled:opacity-50"
            >
              {paying ? "Redirecting..." : "Pay Now"}
            </button>

            <p className="text-xs text-slate-500 text-center mt-4">
              Payment is securely processed by Paystack.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function CheckoutHeader({ tenant }: { tenant: Tenant }) {
  return (
    <header className="bg-white border-b sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <a href={`/store/${tenant.slug}`} className="flex items-center gap-4">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="w-12 h-12 rounded-xl object-cover border"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-slate-200" />
          )}

          <div>
            <p className="text-xl font-bold">{tenant.name}</p>
            <p className="text-xs text-slate-500">Secure Checkout</p>
          </div>
        </a>

        <div className="flex items-center gap-4 flex-wrap">
          <a
            href={`/store/${tenant.slug}`}
            className="text-sm text-slate-500 hover:text-black"
          >
            Store
          </a>

          <a
            href="/customer/profile"
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
            href="/customer/loyalty"
            className="text-sm text-slate-500 hover:text-black"
          >
            My Rewards
          </a>

           <CustomerNotificationBell tenantId={tenant.id} />
          
          <a
            href={`/store/${tenant.slug}/cart`}
            className="bg-black text-white px-4 py-2 rounded-xl text-sm hover:opacity-90"
          >
            Cart
          </a>
        </div>
      </div>
    </header>
  );
}