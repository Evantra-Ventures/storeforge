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
      </nav>
    </aside>
  );
}