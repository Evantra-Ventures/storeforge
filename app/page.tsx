import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <section className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <h1 className="text-4xl font-semibold tracking-tight">StoreForge</h1>
        <p className="mt-4 text-lg text-slate-700">
          Ultra modern multi-tenant ecommerce built for scalable African and global stores.
        </p>
        <div className="mt-8 space-y-4 text-slate-700">
          <p>Visit a store by replacing <code className="rounded bg-slate-100 px-2 py-1">[slug]</code> in the URL.</p>
          <p>Example stores:</p>
          <ul className="ml-4 list-disc">
            <li><Link className="text-sky-600 hover:underline" href="/store/tech-world">/store/tech-world</Link></li>
            <li><Link className="text-sky-600 hover:underline" href="/store/fashion-hub">/store/fashion-hub</Link></li>
          </ul>
        </div>
      </section>
    </main>
  );
}
