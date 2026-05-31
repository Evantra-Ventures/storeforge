export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r min-h-screen p-4">
      <h2 className="text-2xl font-bold mb-8">StoreForge</h2>

      <nav className="space-y-4">
        <a href="/products" className="block">
          Products
        </a>

        <a href="/orders" className="block">
          Orders
        </a>

        <a href="/analytics" className="block">
          Analytics
        </a>

        <a href="/settings" className="block">
          Settings
        </a>

        <a href="/categories" className="block">
          Categories
        </a>

        <a href="/coupons" className="block">
          Coupons
        </a>

        <a href="/shipping" className="block">
          Shipping
        </a>

        <a href="/reviews" className="block">
          Reviews
        </a>

        <a href="/wallet" className="block">
          Wallet
        </a>

        <a href="/admin/payouts" className="block">
          Admin Payouts
        </a>

        <a href="/audit-logs" className="block">
          Audit Logs
        </a>

        <a href="/customers" className="block">
          Customers
        </a>

        <a href="/customers/segments" className="block">
          Customer Segments
        </a>

        <a href="/loyalty" className="block">
          Loyalty
        </a>

        <a href="/dashboard/marketing/announcement" className="block">
          Customer Announcements
        </a>

        <a
          href="/dashboard/marketing/email-queue"
          className="block px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 hover:text-black"
        >
          Email Queue
        </a>

      </nav>
    </aside>
  );
}