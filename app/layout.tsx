import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://storeforge-e2gi.vercel.app"
  ),

  title: {
    default: "StoreForge",
    template: "%s | StoreForge",
  },

  description:
    "StoreForge is a modern multi-tenant ecommerce SaaS platform for creating branded storefronts, managing products, accepting payments, tracking orders, rewarding customers, and growing online stores.",

  keywords: [
    "StoreForge",
    "ecommerce platform",
    "online store builder",
    "multi-tenant ecommerce",
    "storefront SaaS",
    "merchant dashboard",
    "Paystack ecommerce",
    "customer loyalty",
    "online shopping",
    "African ecommerce",
  ],

  authors: [{ name: "StoreForge" }],
  creator: "StoreForge",
  publisher: "StoreForge",

  applicationName: "StoreForge",

  icons: {
    icon: [
      {
        url: "/Favicon.ico",
        sizes: "any",
      },
      {
        url: "/icon.png",
        type: "image/png",
      },
    ],
    shortcut: "/Favicon.ico",
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  openGraph: {
    title: "StoreForge",
    description:
      "Build, launch, and grow modern online stores with StoreForge.",
    url: "/",
    siteName: "StoreForge",
    images: [
      {
        url: "/images/homepage/storeforge-dashboard-hero.png",
        width: 1200,
        height: 630,
        alt: "StoreForge ecommerce dashboard and storefront platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "StoreForge",
    description:
      "Build, launch, and grow modern online stores with StoreForge.",
    images: ["/images/homepage/storeforge-dashboard-hero.png"],
  },

  robots: {
    index: true,
    follow: true,
  },

  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0D1324",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}