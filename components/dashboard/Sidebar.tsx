import Link from "next/link";

const merchantLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Products", href: "/products" },
  { label: "Orders", href: "/orders" },
  { label: "Analytics", href: "/analytics" },
  { label: "Settings", href: "/settings" },
  { label: "Storefront", href: "/settings/storefront" },
  { label: "Categories", href: "/categories" },
  { label: "Coupons", href: "/coupons" },
  { label: "Shipping", href: "/shipping" },
  { label: "Reviews", href: "/reviews" },
  { label: "Wallet", href: "/wallet" },
  { label: "Customers", href: "/customers" },
  { label: "Customer Segments", href: "/customers/segments" },
  { label: "Loyalty", href: "/loyalty" },
  {
    label: "Customer Announcements",
    href: "/dashboard/marketing/announcement",
  },
  {
    label: "Email Queue",
    href: "/dashboard/marketing/email-queue",
  },
];

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200 bg-white lg:block">
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-100 px-6 py-6">
          <Link
            href="/dashboard"
            className="text-2xl font-bold tracking-tight text-slate-950"
          >
            StoreForge
          </Link>

          <p className="mt-2 text-xs text-slate-500">
            Merchant dashboard
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
          {merchantLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-6 py-5 text-xs text-slate-400">
          Manage products, orders, customers, wallet, and storefront settings.
        </div>
      </div>
    </aside>
  );
}

export function MobileDashboardNav() {
  return (
    <nav className="flex gap-2 overflow-x-auto border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
      {merchantLinks.slice(0, 10).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}