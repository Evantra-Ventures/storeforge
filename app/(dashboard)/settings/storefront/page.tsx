"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
};

const themePresets = [
  {
    value: "modern_dark",
    label: "Modern Dark",
    description: "Premium dark hero with bold contrast.",
  },
  {
    value: "minimal_light",
    label: "Minimal Light",
    description: "Clean white layout for simple stores.",
  },
  {
    value: "fashion",
    label: "Fashion",
    description: "Stylish and image-focused for clothing brands.",
  },
  {
    value: "beauty",
    label: "Beauty",
    description: "Soft, elegant colors for cosmetics and skincare.",
  },
  {
    value: "tech",
    label: "Tech",
    description: "Sharp modern style for electronics and gadgets.",
  },
  {
    value: "grocery",
    label: "Grocery",
    description: "Fresh, friendly style for daily essentials.",
  },
  {
    value: "luxury",
    label: "Luxury",
    description: "Premium high-end look for exclusive stores.",
  },
];

const heroLayouts = [
  { value: "split", label: "Split hero" },
  { value: "centered", label: "Centered hero" },
  { value: "banner", label: "Banner hero" },
  { value: "minimal", label: "Minimal hero" },
];

const productCardStyles = [
  { value: "rounded", label: "Rounded cards" },
  { value: "minimal", label: "Minimal cards" },
  { value: "bordered", label: "Bordered cards" },
  { value: "image_focus", label: "Image focus" },
];

const categoryStyles = [
  { value: "pills", label: "Pills" },
  { value: "cards", label: "Cards" },
  { value: "tabs", label: "Tabs" },
  { value: "hidden", label: "Hidden" },
];

const buttonStyles = [
  { value: "rounded", label: "Rounded" },
  { value: "pill", label: "Pill" },
  { value: "sharp", label: "Sharp" },
  { value: "soft", label: "Soft" },
];

const defaultSettings: Partial<StorefrontSettings> = {
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
  hero_heading: "",
  hero_subheading: "",
  featured_section_title: "Popular right now",
  featured_section_subtitle: "Explore featured products from this store.",
  products_section_title: "Shop products",
  products_section_subtitle: "Browse products, options, and collections.",
  hero_image_url: "",
  promotional_banner_url: "",
  status: "active",
};

export default function StorefrontSettingsPage() {
  const supabase = createClient();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const previewTheme = useMemo(() => {
    const primary = settings?.primary_color || defaultSettings.primary_color!;
    const accent = settings?.accent_color || defaultSettings.accent_color!;
    const background =
      settings?.background_color || defaultSettings.background_color!;
    const text = settings?.text_color || defaultSettings.text_color!;

    return {
      primary,
      accent,
      background,
      text,
    };
  }, [settings]);

  const fetchSettings = async () => {
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
        .select("tenant_id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setErrorMessage(profileError?.message || "Tenant profile not found.");
        return;
      }

      const allowedRoles = ["owner", "store_owner", "admin", "super_admin"];

      if (!allowedRoles.includes(profile.role)) {
        setErrorMessage("You do not have permission to edit storefront design.");
        return;
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("id,name,slug,logo_url,banner_url")
        .eq("id", profile.tenant_id)
        .single();

      if (tenantError || !tenantData) {
        setErrorMessage(tenantError?.message || "Store not found.");
        return;
      }

      setTenant(tenantData);

      await supabase.rpc("ensure_storefront_settings", {
        p_tenant_id: tenantData.id,
      });

      const { data: settingsData, error: settingsError } = await supabase
        .from("storefront_settings")
        .select("*")
        .eq("tenant_id", tenantData.id)
        .maybeSingle();

      if (settingsError) {
        setErrorMessage(settingsError.message);
        return;
      }

      if (!settingsData) {
        setErrorMessage("Storefront settings could not be created.");
        return;
      }

      setSettings({
        ...settingsData,
        hero_image_url: settingsData.hero_image_url || "",
        promotional_banner_url: settingsData.promotional_banner_url || "",
      });
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load storefront settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = <K extends keyof StorefrontSettings>(
    field: K,
    value: StorefrontSettings[K]
  ) => {
    if (!settings) return;

    setSettings({
      ...settings,
      [field]: value,
    });
  };

  const applyPreset = (preset: string) => {
    if (!settings) return;

    const presetMap: Record<
      string,
      {
        primary_color: string;
        accent_color: string;
        background_color: string;
        text_color: string;
        hero_layout: string;
        product_card_style: string;
        category_style: string;
        button_style: string;
      }
    > = {
      modern_dark: {
        primary_color: "#020617",
        accent_color: "#2563eb",
        background_color: "#f8fafc",
        text_color: "#0f172a",
        hero_layout: "split",
        product_card_style: "rounded",
        category_style: "pills",
        button_style: "rounded",
      },
      minimal_light: {
        primary_color: "#ffffff",
        accent_color: "#0f172a",
        background_color: "#ffffff",
        text_color: "#0f172a",
        hero_layout: "minimal",
        product_card_style: "minimal",
        category_style: "tabs",
        button_style: "sharp",
      },
      fashion: {
        primary_color: "#831843",
        accent_color: "#ec4899",
        background_color: "#fff1f2",
        text_color: "#1f2937",
        hero_layout: "banner",
        product_card_style: "image_focus",
        category_style: "pills",
        button_style: "pill",
      },
      beauty: {
        primary_color: "#7c2d12",
        accent_color: "#fb7185",
        background_color: "#fff7ed",
        text_color: "#1f2937",
        hero_layout: "centered",
        product_card_style: "rounded",
        category_style: "cards",
        button_style: "soft",
      },
      tech: {
        primary_color: "#020617",
        accent_color: "#06b6d4",
        background_color: "#f8fafc",
        text_color: "#0f172a",
        hero_layout: "split",
        product_card_style: "bordered",
        category_style: "tabs",
        button_style: "rounded",
      },
      grocery: {
        primary_color: "#14532d",
        accent_color: "#22c55e",
        background_color: "#f0fdf4",
        text_color: "#052e16",
        hero_layout: "centered",
        product_card_style: "rounded",
        category_style: "cards",
        button_style: "pill",
      },
      luxury: {
        primary_color: "#111827",
        accent_color: "#d97706",
        background_color: "#fffbeb",
        text_color: "#111827",
        hero_layout: "banner",
        product_card_style: "minimal",
        category_style: "pills",
        button_style: "sharp",
      },
    };

    setSettings({
      ...settings,
      theme_preset: preset,
      ...presetMap[preset],
    });
  };

  const resetToDefault = () => {
    if (!settings) return;

    const confirmed = confirm(
      "Reset storefront design to StoreForge default settings?"
    );

    if (!confirmed) return;

    setSettings({
      ...settings,
      ...defaultSettings,
      id: settings.id,
      tenant_id: settings.tenant_id,
    } as StorefrontSettings);
  };

  const handleSave = async () => {
    if (!settings || !tenant) return;

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("storefront_settings")
        .update({
          theme_preset: settings.theme_preset,

          primary_color: settings.primary_color,
          accent_color: settings.accent_color,
          background_color: settings.background_color,
          text_color: settings.text_color,

          hero_layout: settings.hero_layout,
          product_card_style: settings.product_card_style,
          category_style: settings.category_style,
          button_style: settings.button_style,

          show_search: settings.show_search,
          show_categories: settings.show_categories,
          show_featured_products: settings.show_featured_products,
          show_trust_cards: settings.show_trust_cards,
          show_reviews_section: settings.show_reviews_section,
          show_loyalty_banner: settings.show_loyalty_banner,
          show_coupon_banner: settings.show_coupon_banner,

          hero_badge: settings.hero_badge || null,
          hero_heading: settings.hero_heading || null,
          hero_subheading: settings.hero_subheading || null,
          featured_section_title: settings.featured_section_title || null,
          featured_section_subtitle: settings.featured_section_subtitle || null,
          products_section_title: settings.products_section_title || null,
          products_section_subtitle: settings.products_section_subtitle || null,

          hero_image_url: settings.hero_image_url || null,
          promotional_banner_url: settings.promotional_banner_url || null,

          status: settings.status,
        })
        .eq("id", settings.id)
        .eq("tenant_id", tenant.id);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Storefront design settings saved successfully.");
      fetchSettings();
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to save storefront settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-500">Loading storefront design settings...</p>
      </div>
    );
  }

  if (!tenant || !settings) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">
          Storefront settings unavailable
        </h1>

        <p className="mt-2 text-slate-500">
          {errorMessage || "Could not load storefront settings."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%)]" />

        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-center">
          <div className="lg:col-span-2">
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Storefront customization
            </div>

            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Design a storefront that matches your brand.
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              Choose colors, layouts, product card styles, category styles, and
              storefront sections while StoreForge keeps search, categories,
              products, cart, checkout, loyalty, and notifications working.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href={`/store/${tenant.slug}`}
                target="_blank"
                className="rounded-2xl bg-white px-6 py-4 text-center font-semibold text-slate-950 hover:bg-slate-200"
              >
                Preview storefront
              </a>

              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-2xl border border-white/15 px-6 py-4 text-center font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save design"}
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white p-4 text-slate-950 shadow-2xl">
            <StorefrontPreview
              tenant={tenant}
              settings={settings}
              previewTheme={previewTheme}
            />
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

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="space-y-8 xl:col-span-2">
          <Panel
            title="Theme preset"
            description="Start with a style that matches your store type. You can still adjust colors after choosing a preset."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {themePresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyPreset(preset.value)}
                  className={`rounded-3xl border p-5 text-left transition hover:-translate-y-1 hover:shadow-md ${
                    settings.theme_preset === preset.value
                      ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="font-bold text-slate-950">{preset.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title="Brand colors"
            description="These colors will be used across your storefront, product pages, buttons, and visual sections."
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ColorField
                label="Primary color"
                value={settings.primary_color}
                onChange={(value) => updateField("primary_color", value)}
              />

              <ColorField
                label="Accent color"
                value={settings.accent_color}
                onChange={(value) => updateField("accent_color", value)}
              />

              <ColorField
                label="Background color"
                value={settings.background_color}
                onChange={(value) => updateField("background_color", value)}
              />

              <ColorField
                label="Text color"
                value={settings.text_color}
                onChange={(value) => updateField("text_color", value)}
              />
            </div>
          </Panel>

          <Panel
            title="Layout styles"
            description="Choose how your hero, products, categories, and buttons should appear."
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <SelectField
                label="Hero layout"
                value={settings.hero_layout}
                options={heroLayouts}
                onChange={(value) => updateField("hero_layout", value)}
              />

              <SelectField
                label="Product card style"
                value={settings.product_card_style}
                options={productCardStyles}
                onChange={(value) => updateField("product_card_style", value)}
              />

              <SelectField
                label="Category style"
                value={settings.category_style}
                options={categoryStyles}
                onChange={(value) => updateField("category_style", value)}
              />

              <SelectField
                label="Button style"
                value={settings.button_style}
                options={buttonStyles}
                onChange={(value) => updateField("button_style", value)}
              />
            </div>
          </Panel>

          <Panel
            title="Storefront text"
            description="Customize your homepage hero and section headings. Leave blank to use store defaults."
          >
            <div className="grid grid-cols-1 gap-5">
              <TextField
                label="Hero badge"
                value={settings.hero_badge || ""}
                onChange={(value) => updateField("hero_badge", value)}
              />

              <TextField
                label="Hero heading"
                value={settings.hero_heading || ""}
                onChange={(value) => updateField("hero_heading", value)}
                placeholder={`${tenant.name}`}
              />

              <TextAreaField
                label="Hero subheading"
                value={settings.hero_subheading || ""}
                onChange={(value) => updateField("hero_subheading", value)}
                placeholder="Describe what customers can buy from your store."
              />

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextField
                  label="Featured section title"
                  value={settings.featured_section_title || ""}
                  onChange={(value) =>
                    updateField("featured_section_title", value)
                  }
                />

                <TextField
                  label="Products section title"
                  value={settings.products_section_title || ""}
                  onChange={(value) =>
                    updateField("products_section_title", value)
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <TextAreaField
                  label="Featured section subtitle"
                  value={settings.featured_section_subtitle || ""}
                  onChange={(value) =>
                    updateField("featured_section_subtitle", value)
                  }
                />

                <TextAreaField
                  label="Products section subtitle"
                  value={settings.products_section_subtitle || ""}
                  onChange={(value) =>
                    updateField("products_section_subtitle", value)
                  }
                />
              </div>
            </div>
          </Panel>

          <Panel
            title="Optional media"
            description="Use image URLs for hero or promotional banner images. Later we can add direct upload support."
          >
            <div className="grid grid-cols-1 gap-5">
              <TextField
                label="Hero image URL"
                value={settings.hero_image_url || ""}
                onChange={(value) => updateField("hero_image_url", value)}
                placeholder="https://..."
              />

              <TextField
                label="Promotional banner URL"
                value={settings.promotional_banner_url || ""}
                onChange={(value) =>
                  updateField("promotional_banner_url", value)
                }
                placeholder="https://..."
              />
            </div>
          </Panel>
        </div>

        <aside className="space-y-8">
          <Panel
            title="Visible sections"
            description="Turn storefront homepage sections on or off."
          >
            <div className="space-y-3">
              <ToggleField
                label="Search bar"
                checked={settings.show_search}
                onChange={(value) => updateField("show_search", value)}
              />

              <ToggleField
                label="Categories"
                checked={settings.show_categories}
                onChange={(value) => updateField("show_categories", value)}
              />

              <ToggleField
                label="Featured products"
                checked={settings.show_featured_products}
                onChange={(value) =>
                  updateField("show_featured_products", value)
                }
              />

              <ToggleField
                label="Trust cards"
                checked={settings.show_trust_cards}
                onChange={(value) => updateField("show_trust_cards", value)}
              />

              <ToggleField
                label="Reviews section"
                checked={settings.show_reviews_section}
                onChange={(value) =>
                  updateField("show_reviews_section", value)
                }
              />

              <ToggleField
                label="Loyalty banner"
                checked={settings.show_loyalty_banner}
                onChange={(value) => updateField("show_loyalty_banner", value)}
              />

              <ToggleField
                label="Coupon banner"
                checked={settings.show_coupon_banner}
                onChange={(value) => updateField("show_coupon_banner", value)}
              />
            </div>
          </Panel>

          <Panel title="Status">
            <SelectField
              label="Storefront settings status"
              value={settings.status}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              onChange={(value) => updateField("status", value)}
            />
          </Panel>

          <Panel title="Actions">
            <div className="space-y-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save design settings"}
              </button>

              <button
                onClick={resetToDefault}
                className="w-full rounded-2xl border border-slate-200 px-5 py-3 font-semibold hover:bg-slate-50"
              >
                Reset to StoreForge default
              </button>

              <a
                href={`/store/${tenant.slug}`}
                target="_blank"
                className="block w-full rounded-2xl border border-slate-200 px-5 py-3 text-center font-semibold hover:bg-slate-50"
              >
                Open storefront
              </a>
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function StorefrontPreview({
  tenant,
  settings,
  previewTheme,
}: {
  tenant: Tenant;
  settings: StorefrontSettings;
  previewTheme: {
    primary: string;
    accent: string;
    background: string;
    text: string;
  };
}) {
  return (
    <div
      className="overflow-hidden rounded-[1.5rem] border border-slate-200"
      style={{
        backgroundColor: previewTheme.background,
        color: previewTheme.text,
      }}
    >
      <div
        className="p-5 text-white"
        style={{
          backgroundColor: previewTheme.primary,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={tenant.name}
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-950">
                {tenant.name.slice(0, 1)}
              </div>
            )}

            <div>
              <p className="text-sm font-semibold">{tenant.name}</p>
              <p className="text-xs text-white/70">
                {settings.theme_preset.replaceAll("_", " ")}
              </p>
            </div>
          </div>

          <div
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: previewTheme.accent }}
          >
            Live
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs text-white/70">
            {settings.hero_badge || "Live store · Powered by StoreForge"}
          </p>

          <h3 className="mt-2 text-2xl font-bold">
            {settings.hero_heading || tenant.name}
          </h3>

          <p className="mt-2 text-sm leading-6 text-white/75">
            {settings.hero_subheading ||
              "A modern storefront with products, categories, search, cart, checkout, loyalty, and notifications."}
          </p>

          <button
            className={`mt-5 px-5 py-3 text-sm font-semibold text-white ${
              settings.button_style === "pill"
                ? "rounded-full"
                : settings.button_style === "sharp"
                ? "rounded-none"
                : settings.button_style === "soft"
                ? "rounded-xl"
                : "rounded-2xl"
            }`}
            style={{ backgroundColor: previewTheme.accent }}
          >
            Shop now
          </button>
        </div>
      </div>

      <div className="p-5">
        {settings.show_search && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
            Search products...
          </div>
        )}

        {settings.show_categories && settings.category_style !== "hidden" && (
          <div className="mb-5 flex gap-2 overflow-hidden">
            {["All", "Featured", "New"].map((item) => (
              <span
                key={item}
                className={`whitespace-nowrap border border-slate-200 bg-white px-3 py-2 text-xs ${
                  settings.category_style === "tabs"
                    ? "rounded-none border-x-0 border-t-0"
                    : settings.category_style === "cards"
                    ? "rounded-xl"
                    : "rounded-full"
                }`}
              >
                {item}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((item) => (
            <div
              key={item}
              className={`border border-slate-200 bg-white p-3 ${
                settings.product_card_style === "minimal"
                  ? "rounded-none shadow-none"
                  : settings.product_card_style === "bordered"
                  ? "rounded-2xl border-2"
                  : "rounded-2xl shadow-sm"
              }`}
            >
              <div
                className={`h-20 bg-slate-100 ${
                  settings.product_card_style === "image_focus"
                    ? "rounded-2xl"
                    : "rounded-xl"
                }`}
              />

              <p className="mt-3 text-sm font-semibold">Product {item}</p>
              <p className="mt-1 text-xs text-slate-500">GHS 99.00</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <div className="flex gap-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-14 rounded-xl border border-slate-200 bg-white p-1"
        />

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="field-input"
        />
      </div>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-input"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-input min-h-[110px]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: {
    value: string;
    label: string;
  }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
      <span className="text-sm font-medium text-slate-700">{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}