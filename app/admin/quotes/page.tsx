import Link from "next/link";

import { getRecentQuotes } from "lib/quotes";

import { CopyLinkButton } from "./CopyLinkButton";

type Props = {
  searchParams?: Promise<{ status?: string; q?: string }>;
};

async function resolveParams<T extends Record<string, unknown>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function formatCurrency(value: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
  return formatter.format(value);
}

function normalizeStatus(status?: string | null) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "draft" || normalized === "issued") return normalized;
  return "all";
}

export default async function AdminQuotesPage({ searchParams }: Props) {
  const resolvedSearch = await resolveParams<{ status?: string; q?: string }>(searchParams ?? {});
  const status = normalizeStatus(resolvedSearch.status);
  const q = resolvedSearch.q ? String(resolvedSearch.q) : "";

  const quotes = await getRecentQuotes({
    status: status === "all" ? undefined : (status as "draft" | "issued"),
    search: q,
  });

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-600">Admin</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Quotes</h1>
          <p className="text-sm text-neutral-600">Latest {quotes.length} quotes (limit 200).</p>
        </div>
        <Link
          href="/quotes"
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          prefetch={false}
        >
          Customer lookup
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-700" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
          </select>
        </div>
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-neutral-700" htmlFor="q">
            Search (quote #, email, company)
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="e.g. 250101-001 or customer@email.com"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800"
        >
          Apply
        </button>
        <Link
          href="/admin/quotes"
          className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          prefetch={false}
        >
          Reset
        </Link>
      </form>

      <div className="overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="min-w-[960px]">
          <div className="grid grid-cols-[1.2fr_1.2fr_1.2fr_0.8fr_1.2fr_1.4fr_1.2fr_1fr_0.7fr] gap-2 border-b border-neutral-200 px-4 py-3 text-xs font-semibold uppercase text-neutral-600">
            <span>Quote</span>
            <span>Created</span>
            <span>Issued</span>
            <span>Status</span>
            <span>Customer</span>
            <span>Email</span>
            <span>Company</span>
            <span className="text-right">Total</span>
            <span className="text-right">Currency</span>
          </div>
          {quotes.map((quote) => {
            const publicLink = `/quotes/${quote.quote_number}?e=${encodeURIComponent(quote.email)}`;
            const pdfLink = `/api/quotes/${quote.quote_number}/pdf?e=${encodeURIComponent(quote.email)}`;
            const statusLabel = quote.status === "issued" ? "Issued" : "Draft";
            const currency = quote.currency || "GBP";
            return (
              <div key={quote.id} className="border-b border-neutral-200 px-4 py-3">
                <div className="grid grid-cols-[1.2fr_1.2fr_1.2fr_0.8fr_1.2fr_1.4fr_1.2fr_1fr_0.7fr] items-start gap-2 text-sm text-neutral-800">
                  <div>
                    <p className="font-semibold text-neutral-900">{quote.quote_number}</p>
                  </div>
                  <div className="text-sm text-neutral-700">{formatDate(quote.created_at)}</div>
                  <div className="text-sm text-neutral-700">{formatDate(quote.issued_at)}</div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        quote.status === "issued" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-800">{quote.reference || "—"}</div>
                  <div className="text-sm text-neutral-800">{quote.email}</div>
                  <div className="text-sm text-neutral-800">{quote.company || "—"}</div>
                  <div className="text-right font-semibold">{formatCurrency(quote.total_value || 0, currency)}</div>
                  <div className="text-right text-xs font-semibold uppercase text-neutral-600">{currency}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <Link
                    href={publicLink}
                    className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                    prefetch={false}
                  >
                    View
                  </Link>
                  <CopyLinkButton link={publicLink} />
                  <Link
                    href={pdfLink}
                    className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                    prefetch={false}
                  >
                    Download PDF
                  </Link>
                </div>
              </div>
            );
          })}
          {quotes.length === 0 ? <p className="px-4 py-4 text-sm text-neutral-600">No quotes found.</p> : null}
        </div>
      </div>
    </section>
  );
}
