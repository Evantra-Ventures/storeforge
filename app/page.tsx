import Link from "next/link";

const features = [
  {
    title: "Launch beautiful storefronts",
    description:
      "Create modern online stores with products, categories, variants, images, carts, checkout, and customer accounts.",
  },
  {
    title: "Manage orders with confidence",
    description:
      "Track orders, delivery status, refunds, customer details, audit logs, and payment activity from one dashboard.",
  },
  {
    title: "Accept payments with Paystack",
    description:
      "Let customers checkout securely while your store tracks payment status, callbacks, webhooks, and receipts.",
  },
  {
    title: "Grow customer loyalty",
    description:
      "Reward buyers with loyalty points, customer profiles, address books, segments, wishlists, and targeted offers.",
  },
  {
    title: "Send smart notifications",
    description:
      "Notify customers about orders, delivery, refunds, coupons, wishlist price drops, back-in-stock alerts, and email updates.",
  },
  {
    title: "Built for multi-store scale",
    description:
      "Run multiple stores on one platform with tenant-based data, secure access, dashboards, and scalable workflows.",
  },
];

const steps = [
  {
    title: "Create your store",
    description:
      "Set up your store profile, branding, products, categories, shipping, and payment settings.",
  },
  {
    title: "Start selling online",
    description:
      "Customers browse your storefront, add items to cart, checkout, and receive automatic order updates.",
  },
  {
    title: "Grow with insights",
    description:
      "Track customers, orders, loyalty, notifications, campaigns, and performance from your dashboard.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            StoreForge
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white">
              How it works
            </a>
            <a href="#demo-stores" className="hover:text-white">
              Demo stores
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white sm:inline-block"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.25),transparent_35%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_35%)]" />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200">
              Ecommerce infrastructure for ambitious stores
            </div>

            <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-white md:text-6xl">
              Build, launch, and grow your online store faster.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              StoreForge helps merchants create modern storefronts, manage
              products, accept payments, track orders, reward loyal customers,
              and send smart notifications from one powerful dashboard.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="rounded-2xl bg-white px-7 py-4 text-center font-semibold text-slate-950 hover:bg-slate-200"
              >
                Start building your store
              </Link>

              <Link
                href="/store/tech-world"
                className="rounded-2xl border border-white/15 px-7 py-4 text-center font-semibold text-white hover:bg-white/10"
              >
                View demo store
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
              <div>
                <p className="text-3xl font-bold">Multi</p>
                <p className="mt-1 text-sm text-slate-400">tenant stores</p>
              </div>

              <div>
                <p className="text-3xl font-bold">24/7</p>
                <p className="mt-1 text-sm text-slate-400">online selling</p>
              </div>

              <div>
                <p className="text-3xl font-bold">Smart</p>
                <p className="mt-1 text-sm text-slate-400">notifications</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
            <div className="rounded-2xl bg-white p-5 text-slate-950">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <p className="text-sm text-slate-500">Store Dashboard</p>
                  <h2 className="text-xl font-bold">Today’s performance</h2>
                </div>

                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Live
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <DashboardCard label="Orders" value="128" />
                <DashboardCard label="Revenue" value="GHS 9.4k" />
                <DashboardCard label="Customers" value="642" />
                <DashboardCard label="Notifications" value="1,204" />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold">Recent activity</p>

                <div className="mt-4 space-y-3">
                  <Activity text="Order #A19F marked out for delivery" />
                  <Activity text="Coupon campaign sent to customers" />
                  <Activity text="Wishlist price-drop notification queued" />
                  <Activity text="Low stock alert sent to merchant" />
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-sm text-slate-300">Next step</p>
                <p className="mt-1 text-lg font-bold">
                  Process pending email queue
                </p>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div className="h-2 w-3/4 rounded-full bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 text-slate-950" id="features">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
              Everything your store needs
            </p>

            <h2 className="mt-3 text-4xl font-bold tracking-tight">
              One platform for storefronts, payments, customers, and growth.
            </h2>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              StoreForge combines the tools merchants need to sell online,
              serve customers better, and scale across markets.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-bold text-white">
                  ✓
                </div>

                <h3 className="text-xl font-bold">{feature.title}</h3>

                <p className="mt-3 leading-7 text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-20 text-slate-950" id="how-it-works">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
              How it works
            </p>

            <h2 className="mt-3 text-4xl font-bold tracking-tight">
              From idea to online store in simple steps.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-lg font-bold text-white">
                  {index + 1}
                </div>

                <h3 className="mt-6 text-xl font-bold">{step.title}</h3>

                <p className="mt-3 leading-7 text-slate-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 text-slate-950" id="demo-stores">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                Storefront experience
              </p>

              <h2 className="mt-3 text-4xl font-bold tracking-tight">
                Give every merchant a fast, clean, mobile-friendly store.
              </h2>

              <p className="mt-4 text-lg leading-8 text-slate-600">
                Each store gets its own storefront URL, customer cart, checkout,
                wishlist, notifications, profile, loyalty rewards, and order
                history.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/store/tech-world"
                  className="rounded-2xl bg-slate-950 px-6 py-4 text-center font-semibold text-white hover:bg-slate-800"
                >
                  Visit Tech World
                </Link>

                <Link
                  href="/store/fashion-hub"
                  className="rounded-2xl border border-slate-300 px-6 py-4 text-center font-semibold hover:bg-slate-50"
                >
                  Visit Fashion Hub
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="grid grid-cols-2 gap-4">
                <StoreCard title="Tech World" category="Electronics" />
                <StoreCard title="Fashion Hub" category="Fashion" />
                <StoreCard title="Beauty Market" category="Cosmetics" />
                <StoreCard title="Home Essentials" category="Lifestyle" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-4xl font-bold tracking-tight">
            Ready to forge your next online store?
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Start with a modern ecommerce foundation built for merchants,
            customers, payments, loyalty, notifications, and growth.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-2xl bg-white px-8 py-4 font-semibold text-slate-950 hover:bg-slate-200"
            >
              Create your store
            </Link>

            <Link
              href="/login"
              className="rounded-2xl border border-white/15 px-8 py-4 font-semibold text-white hover:bg-white/10"
            >
              Log in to dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function DashboardCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Activity({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      <p className="text-sm text-slate-700">{text}</p>
    </div>
  );
}

function StoreCard({
  title,
  category,
}: {
  title: string;
  category: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-5 h-24 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100" />
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{category}</p>
    </div>
  );
}
