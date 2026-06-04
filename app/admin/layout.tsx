import Image from "next/image";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-slate-950 text-white lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-6 py-6">
            <Link href="/admin" className="inline-flex items-center">
              <Image
                src="/images/logo/dark-logo.svg"
                alt="StoreForge"
                width={170}
                height={44}
                priority
                className="h-9 w-auto"
              />
            </Link>

            <p className="mt-3 text-xs text-slate-400">
              Platform administration
            </p>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-6 text-sm">
            <AdminLink href="/admin" label="Overview" />
            <AdminLink href="/admin/stores" label="Stores" />
            <AdminLink href="/admin/payout" label="Payout approvals" />
            <AdminLink href="/admin/orders" label="Orders" />
            <AdminLink href="/admin/audit-logs" label="Audit logs" />
            <AdminLink href="/admin/suspicious" label="Suspicious activity" />
          </nav>

          <div className="border-t border-white/10 px-6 py-5 text-xs text-slate-400">
            StoreForge Admin Console
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="inline-flex items-center">
              <Image
                src="/images/logo/primary-logo.svg"
                alt="StoreForge"
                width={160}
                height={44}
                priority
                className="h-8 w-auto"
              />
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
            >
              Home
            </Link>
          </div>

          <nav className="mt-4 flex gap-3 overflow-x-auto pb-1 text-sm">
            <MobileAdminLink href="/admin" label="Overview" />
            <MobileAdminLink href="/admin/stores" label="Stores" />
            <MobileAdminLink href="/admin/payout" label="Payouts" />
            <MobileAdminLink href="/admin/orders" label="Orders" />
            <MobileAdminLink href="/admin/audit-logs" label="Logs" />
          </nav>
        </header>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </main>
  );
}

function AdminLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl px-4 py-3 text-slate-300 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}

function MobileAdminLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-600"
    >
      {label}
    </Link>
  );
}