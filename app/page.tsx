import Image from "next/image";
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
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <style>{`
        @keyframes typing {
          from {
            width: 0;
          }
          to {
            width: 22ch;
          }
        }

        @keyframes blink {
          0%, 45% {
            border-color: rgba(255, 255, 255, 0.9);
          }
          46%, 100% {
            border-color: transparent;
          }
        }

        @keyframes floatSoft {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .typing-line {
          display: inline-block;
          max-width: max-content;
          overflow: hidden;
          white-space: nowrap;
          border-right: 3px solid rgba(255, 255, 255, 0.9);
          animation: typing 3.2s steps(22, end) 0.35s both, blink 0.8s step-end infinite;
        }

        .float-soft {
          animation: floatSoft 6s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .typing-line {
            width: auto;
            animation: none;
            border-right: 0;
          }

          .float-soft {
            animation: none;
          }
        }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src="/images/logo/dark-logo.png"
              alt="StoreForge"
              width={170}
              height={44}
              priority
              className="h-8 w-auto sm:h-9"
            />
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-300 lg:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#storefronts" className="transition hover:text-white">
              Storefronts
            </a>
            <a href="#checkout" className="transition hover:text-white">
              Checkout
            </a>
            <a href="#engagement" className="transition hover:text-white">
              Growth
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white sm:inline-block"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="hidden rounded-xl px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white md:inline-block"
            >
              Shop signup
            </Link>

            <Link
              href="/start-selling"
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 sm:px-4"
            >
              Start selling
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.38),transparent_34%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_34%)]" />
        <div className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 shadow-sm backdrop-blur">
              <Image
                src="/images/logo/icon64x64.png"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5"
              />
              <span>Ecommerce infrastructure for ambitious stores</span>
            </div>

            <p className="mb-4 text-lg font-semibold text-sky-300 sm:text-xl">
              <span className="typing-line">Build. Launch. Grow.</span>
            </p>

            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
              Build, launch, and grow your online store faster.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              StoreForge helps merchants create modern storefronts, manage
              products, accept payments, track orders, reward loyal customers,
              and send smart notifications from one powerful dashboard.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/start-selling"
                className="rounded-2xl bg-white px-7 py-4 text-center font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Start building your store
              </Link>

              <Link
                href="/store/tech-world"
                className="rounded-2xl border border-white/15 px-7 py-4 text-center font-semibold text-white transition hover:bg-white/10"
              >
                View demo store
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 border-t border-white/10 pt-8 sm:grid-cols-3">
              <HeroStat title="Multi" text="tenant stores" />
              <HeroStat title="24/7" text="online selling" />
              <HeroStat title="Smart" text="notifications" />
            </div>
          </div>

          <div className="float-soft rounded-[2rem] border border-white/10 bg-white/10 p-2 shadow-2xl backdrop-blur transition duration-300 motion-safe:hover:-translate-y-1 sm:p-3">
            <Image
              src="/images/homepage/storeforge-dashboard-hero.png"
              alt="StoreForge merchant dashboard showing orders, revenue, customers, notifications, and low stock alerts"
              width={1672}
              height={941}
              priority
              className="h-auto w-full rounded-[1.5rem] shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-16 text-slate-950 sm:py-20" id="features">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
              Everything your store needs
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              One platform for storefronts, payments, customers, and growth.
            </h2>

            <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
              StoreForge combines the tools merchants need to sell online,
              serve customers better, and scale across markets.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 motion-safe:hover:-translate-y-1 hover:shadow-lg"
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

      <section
        className="bg-slate-50 py-16 text-slate-950 sm:py-20"
        id="storefronts"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                Storefront experience
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Give every merchant a fast, beautiful, mobile-friendly store.
              </h2>

              <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
                Each store gets its own storefront URL, product catalog,
                categories, cart, checkout, wishlist, notifications, profile,
                loyalty rewards, and order history.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/store/tech-world"
                  className="rounded-2xl bg-slate-950 px-6 py-4 text-center font-semibold text-white transition hover:bg-slate-800"
                >
                  Visit Tech World
                </Link>

                <Link
                  href="/store/fashion-hub"
                  className="rounded-2xl border border-slate-300 px-6 py-4 text-center font-semibold transition hover:bg-white"
                >
                  Visit Fashion Hub
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-2 shadow-xl transition duration-300 motion-safe:hover:-translate-y-1 sm:p-3">
              <Image
                src="/images/homepage/storeforge-storefronts.png"
                alt="StoreForge storefront demo previews for tech, fashion, and beauty stores"
                width={1672}
                height={941}
                className="h-auto w-full rounded-[1.5rem]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-16 text-white sm:py-20" id="checkout">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div className="order-2 rounded-[2rem] border border-white/10 bg-white/10 p-2 shadow-2xl transition duration-300 motion-safe:hover:-translate-y-1 sm:p-3 lg:order-1">
              <Image
                src="/images/homepage/storeforge-checkout-payments.png"
                alt="StoreForge checkout, payments, shipping, coupon, loyalty points, and order tracking interface"
                width={1672}
                height={941}
                className="h-auto w-full rounded-[1.5rem]"
              />
            </div>

            <div className="order-1 lg:order-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-400">
                Checkout and payments
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Turn browsers into buyers with a smooth checkout flow.
              </h2>

              <p className="mt-4 text-base leading-8 text-slate-300 sm:text-lg">
                Support delivery or pickup, shipping zones, coupon discounts,
                loyalty point redemption, secure payment initialization,
                callbacks, receipts, and order tracking.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MiniFeature
                  title="Paystack-ready"
                  text="Secure payment flow with callback and webhook support."
                />
                <MiniFeature
                  title="Flexible delivery"
                  text="Shipping zones, pickup, delivery status, and order updates."
                />
                <MiniFeature
                  title="Coupons & loyalty"
                  text="Discounts, rewards, points, and smarter retention."
                />
                <MiniFeature
                  title="Receipts & emails"
                  text="Queue receipts and notifications with Resend."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="bg-white py-16 text-slate-950 sm:py-20"
        id="engagement"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
                Customer engagement
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Keep customers coming back with loyalty, wishlists, and smart
                notifications.
              </h2>

              <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
                StoreForge helps merchants build repeat purchases with loyalty
                points, reward balances, wishlist alerts, reviews, coupon
                campaigns, notification preferences, and email queue processing.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MiniFeatureLight
                  title="Loyalty rewards"
                  text="Points, rewards, redemptions, and customer value tracking."
                />
                <MiniFeatureLight
                  title="Wishlist alerts"
                  text="Back-in-stock and price-drop notifications for saved products."
                />
                <MiniFeatureLight
                  title="Campaigns"
                  text="Send coupon and marketing announcements to targeted audiences."
                />
                <MiniFeatureLight
                  title="Preferences"
                  text="Customers control what updates and channels they receive."
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-2 shadow-xl transition duration-300 motion-safe:hover:-translate-y-1 sm:p-3">
              <Image
                src="/images/homepage/storeforge-customer-engagement.png"
                alt="StoreForge customer engagement dashboard for loyalty, reviews, wishlists, campaigns, and notifications"
                width={1672}
                height={941}
                className="h-auto w-full rounded-[1.5rem]"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        className="bg-slate-50 py-16 text-slate-950 sm:py-20"
        id="how-it-works"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
              How it works
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              From idea to online store in simple steps.
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition duration-300 motion-safe:hover:-translate-y-1 hover:shadow-lg"
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

      <section className="relative overflow-hidden bg-slate-950 py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.28),transparent_35%)]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <div className="mb-8 flex justify-center">
            <Image
              src="/images/logo/stacked.png"
              alt="StoreForge"
              width={260}
              height={180}
              className="h-auto w-40 sm:w-52"
            />
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to forge your next online store?
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            Start with a modern ecommerce foundation built for merchants,
            customers, payments, loyalty, notifications, and growth.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/start-selling"
              className="rounded-2xl bg-white px-8 py-4 font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Create your store
            </Link>

            <Link
              href="/login"
              className="rounded-2xl border border-white/15 px-8 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              Log in to dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroStat({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-3xl font-bold">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
    </div>
  );
}

function MiniFeature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 transition duration-300 motion-safe:hover:-translate-y-1">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}

function MiniFeatureLight({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition duration-300 motion-safe:hover:-translate-y-1 hover:bg-white">
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}