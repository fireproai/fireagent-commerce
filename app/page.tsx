import Link from "next/link";

const TRUST_POINTS = [
  {
    title: "Trade-only access",
    body: "Catalogue, navigation, and documentation tailored for installers and distributors.",
  },
  {
    title: "Structured navigation",
    body: "Predictable routes keep the catalogue aligned to manufacturers and categories.",
  },
  {
    title: "Compliance-first",
    body: "Built for quotations, submittals, and procurement approvals with clear docs.",
  },
  {
    title: "No lifestyle fluff",
    body: "Fast-loading pages with direct CTAs and no consumer pricing or marketing filler.",
  },
];

const MANUFACTURERS = [
  {
    title: "Gent by Honeywell",
    href: "/products/gent-by-honeywell",
    description: "Addressable, self-test, and peripherals.",
  },
  {
    title: "Morley",
    href: "/products/morley",
    description: "Panels, diagnostics, and System Sensor loops.",
  },
  {
    title: "Xtralis",
    href: "/products/xtralis",
    description: "Aspirating detection and accessories.",
  },
  {
    title: "FAAST",
    href: "/products/faast",
    description: "Aspirating smoke detection systems.",
  },
  {
    title: "Honeywell CLSS",
    href: "/products/honeywell-clss",
    description: "Cloud services, gateways, and upgrades.",
  },
  {
    title: "Li-ion Tamer",
    href: "/products/li-ion-tamer",
    description: "Off-gas detection for lithium-ion batteries.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12 md:space-y-14">
      <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-100"
        />
        <div className="relative grid gap-8 p-8 sm:p-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
              TRADE-ONLY | DATA-LED CATALOGUE
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl">
                Trade fire alarm catalogue, built for procurement
              </h1>
              <p className="text-base text-neutral-700 sm:text-lg">
                A structured, trade-only fire alarm catalogue with predictable URLs, manufacturer-aligned
                navigation, and direct access to technical documentation.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
              >
                Browse catalogue
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                Contact trade team
              </Link>
            </div>
            <div
              data-testid="opening-banner"
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4"
            >
              <p className="text-lg font-semibold text-neutral-900">Launching Spring 2026</p>
              <p className="mt-1 text-sm text-neutral-700">
                Trade fire alarm parts, peripherals, and accessories. Catalogue onboarding in progress.
              </p>
            </div>
          </div>
          <div className="relative rounded-xl border border-neutral-200 bg-neutral-50 p-6 shadow-inner">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Built for procurement</p>
                <p className="text-sm text-neutral-600">
                  Predictable URLs, fast browse paths, and documentation-first pages. No consumer pricing. No
                  marketing filler.
                </p>
              </div>
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold uppercase text-white">
                Pro
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <p className="text-sm font-semibold text-neutral-900">Navigation fidelity</p>
                <p className="mt-1 text-sm text-neutral-700">
                  Structured routes keep categories and brands consistent for procurement teams.
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-3">
                <p className="text-sm font-semibold text-neutral-900">Trade expectations</p>
                <p className="mt-1 text-sm text-neutral-700">
                  Built for quotations, submittals, and procurement workflows — not consumer checkouts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white/70 p-6 shadow-sm sm:p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-neutral-900">Why trade teams use this catalogue</h2>
          <span className="text-xs font-semibold uppercase text-neutral-500">Trade focus</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <p className="text-sm font-semibold text-neutral-900">{point.title}</p>
              <p className="mt-1 text-sm text-neutral-700">{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Manufacturers available at launch</h2>
            <p className="text-sm text-neutral-700">
              Direct links into the catalogue by manufacturer, where available.
            </p>
          </div>
          <Link href="/products" className="text-sm font-semibold text-neutral-900 hover:text-neutral-700">
            Browse catalogue
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MANUFACTURERS.map((manufacturer) => (
            <Link
              key={manufacturer.title}
              href={manufacturer.href}
              className="group flex h-full flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
            >
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  {manufacturer.title}
                </p>
                <p className="text-lg font-semibold text-neutral-900">{manufacturer.description}</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <span>View</span>
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 12h14m-6-6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-neutral-900 px-6 py-5 text-white shadow-sm sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-neutral-200">Trade enquiries</p>
            <p className="text-sm text-neutral-100">
              Trade enquiries: catalogue access, pricing workflows, and manufacturer onboarding.
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-neutral-50"
          >
            Contact trade team
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <h3 className="text-lg font-semibold text-neutral-900">Compliance and expectations</h3>
        <p className="mt-2 text-sm text-neutral-700">
          Manufacturer navigation stays aligned with the product tree for predictable URLs. Expect trade-only
          access, clear documentation paths, and fast handoffs for pricing and submittals.
        </p>
      </section>
    </div>
  );
}
