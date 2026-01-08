import Link from "next/link";

const VALUE_POINTS = [
  {
    title: "Engineer-ready product data",
    description: "Accurate specs, compatibility, and documentation",
  },
  {
    title: "Fast ordering workflows",
    description: "Quick Cart and Quick Quote - no basket friction",
  },
  {
    title: "Built on structured PIM data",
    description: "Consistent, scalable, and audit-safe",
  },
  {
    title: "Designed for professional use",
    description: "No consumer checkout patterns, no noise",
  },
];

const BROWSE_LINKS = [
  { label: "View all products", href: "/products" },
  { label: "Browse categories", href: "/categories" },
  { label: "Search catalogue", href: "/search" },
  { label: "Quick Cart", href: "/quick-cart" },
  { label: "Quick Quote", href: "/quick-quote" },
];

export default function HomePage() {
  return (
    <div className="space-y-12 md:space-y-14">
      <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100"
        />
        <div className="relative grid gap-10 p-8 sm:p-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
              Trade-only | Structured catalogue
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-neutral-900 sm:text-4xl">
                Trade-Only Fire Alarm Equipment Supply
              </h1>
              <p className="text-base text-neutral-700 sm:text-lg">
                Fast ordering, accurate data, and professional quoting - built for fire engineers.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/quick-cart"
                  className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
                >
                  Quick Cart
                </Link>
                <Link
                  href="/quick-quote"
                  className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-50"
                >
                  Quick Quote
                </Link>
              </div>
              <p className="text-sm text-neutral-600">Trade customers only | Account required</p>
            </div>
          </div>
          <div className="relative rounded-xl border border-neutral-200 bg-neutral-50 p-6 shadow-inner">
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-neutral-900">Direct-to-order workflows</p>
                <p className="text-sm text-neutral-700">
                  Quick Cart for fast basket-free ordering. Quick Quote for professional proposals with the same
                  data model.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                  <p className="text-sm font-semibold text-neutral-900">Structured catalogue</p>
                  <p className="mt-1 text-sm text-neutral-700">
                    Consistent routes and documentation-first product detail.
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-white p-3">
                  <p className="text-sm font-semibold text-neutral-900">Trade clarity</p>
                  <p className="mt-1 text-sm text-neutral-700">No consumer checkout patterns. Built for engineers.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white/70 p-6 shadow-sm sm:p-8">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-neutral-900">Built for trade teams</h2>
          <p className="text-sm text-neutral-700">Structured data, predictable navigation, and fast handoffs.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {VALUE_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <p className="text-sm font-semibold text-neutral-900">{point.title}</p>
              <p className="mt-1 text-sm text-neutral-700">{point.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-neutral-900">Browse Catalogue</h2>
          <p className="text-sm text-neutral-700">
            Jump straight into the catalogue, or use Quick Cart / Quick Quote to order fast.
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BROWSE_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              <span>{item.label}</span>
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-neutral-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm text-neutral-700">
          FireAgent is a trade-only supply platform built around structured product data, professional workflows,
          and modern fire-industry requirements. Designed for engineers, integrators, and maintainers.
        </p>
      </section>
    </div>
  );
}
