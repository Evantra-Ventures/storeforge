import Link from "next/link";
import Sidebar, { MobileDashboardNav } from "@/components/dashboard/Sidebar";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <Sidebar />

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <Link
                href="/dashboard"
                className="block text-xl font-bold tracking-tight text-slate-950 lg:hidden"
              >
                StoreForge
              </Link>

              <h1 className="hidden text-lg font-bold text-slate-950 lg:block">
                Dashboard
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="hidden rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:inline-flex"
              >
                Dashboard
              </Link>

              <Link
                href="/settings"
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                User Menu
              </Link>
            </div>
          </div>

          <MobileDashboardNav />
        </header>

        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </section>
      </div>
    </main>
  );
}