import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoreForge",
  description: "Ultra modern multi-tenant SaaS ecommerce storefront platform.",
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
