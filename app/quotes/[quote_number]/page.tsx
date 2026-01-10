import Link from "next/link";
import { cookies } from "next/headers";

import { coerceAmount, formatMoney } from "lib/money";
import { formatDateUK } from "lib/quote-pdf";
import { getQuoteByNumber, validateQuoteToken } from "lib/quotes";
import { getStoreCurrency } from "lib/shopify/storeCurrency";
import { QuoteActions } from "./QuoteActions";

type Props = {
  params: Promise<{ quote_number: string }>;
  searchParams?: Promise<{ e?: string; token?: string }>;
};

async function resolveParams<T extends Record<string, unknown>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

async function isLoggedIn() {
  const jar = await cookies();
  const markers = ["_secure_customer_sig", "customer_signed_in", "customerLoggedIn"];
  return markers.some((name) => jar.get(name));
}

function getLoginUrl() {
  const shopDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "mn2jyi-ez.myshopify.com";
  return `https://${shopDomain}/account/login`;
}

export default async function QuoteDetailPage({ params, searchParams }: Props) {
  const loggedIn = await isLoggedIn();
  const loginUrl = getLoginUrl();
  const resolvedParams = await resolveParams<{ quote_number: string }>(params);
  const resolvedSearch = await resolveParams<{ e?: string; token?: string }>(searchParams ?? {});
  const emailParam = (resolvedSearch?.e || "").toLowerCase();
  const tokenParam = resolvedSearch?.token || "";
  const quote = await getQuoteByNumber(resolvedParams.quote_number, { ensurePublicToken: true });

  if (!quote) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-neutral-900">Quote not found</h1>
          <p className="text-sm text-neutral-600">
            Check the quote number and email, or return to{" "}
            <Link href="/quotes" className="text-blue-700 hover:underline">
              quote lookup
            </Link>
            .
          </p>
        </div>
      </section>
    );
  }

  const tokenValidation = validateQuoteToken(quote, tokenParam);
  const emailMatches = emailParam ? quote.email.toLowerCase() === emailParam : false;
  const canView = tokenValidation.valid || (loggedIn && emailMatches);

  if (!canView) {
    const hasToken = Boolean(tokenParam);
    const tokenError =
      tokenValidation.reason === "expired"
        ? "This quote link has expired."
        : "This quote link is invalid.";

    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-neutral-900">
            {hasToken ? "Link unavailable" : "Login required"}
          </h1>
          <p className="text-sm text-neutral-700">
            {hasToken ? (
              <>
                {tokenError}{" "}
                <Link href="mailto:shop@fireagent.co.uk" className="text-blue-700 hover:underline">
                  Email us
                </Link>{" "}
                for a fresh link.
              </>
            ) : (
              <>
                Please{" "}
                <Link href={loginUrl} className="text-blue-700 hover:underline">
                  log in
                </Link>{" "}
                to view this quote.
              </>
            )}
          </p>
        </div>
      </section>
    );
  }

  const currency = await getStoreCurrency();
  const subtotalValue =
    coerceAmount(quote.subtotal_ex_vat) ??
    quote.lines.reduce((sum, line) => {
      const qty = Number(line.qty ?? 0);
      const unit = coerceAmount(line.unit_price_ex_vat) ?? 0;
      const lineTotal = coerceAmount(line.line_total_ex_vat);
      return sum + (lineTotal ?? unit * qty);
    }, 0);
  const pdfToken = tokenValidation.valid ? tokenParam : quote.publicToken;
  const pdfHref = `/api/quotes/${quote.quote_number}/pdf?token=${encodeURIComponent(pdfToken || "")}`;
  const issuedAt = quote.issued_at ? new Date(quote.issued_at) : null;
  const tokenExpiry = quote.publicTokenExpiresAt ? formatDateUK(quote.publicTokenExpiresAt) : null;
  const lineGridClass =
    "grid grid-cols-[minmax(7rem,14ch)_minmax(18rem,1fr)_minmax(4rem,6ch)_minmax(8rem,12ch)_minmax(9rem,13ch)] gap-x-4";

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-500">Quote</p>
            <h1 className="text-2xl font-semibold text-neutral-900">{quote.quote_number}</h1>
            <p className="text-sm text-neutral-600">
              Date: {formatDateUK(quote.quote_date)} | Status: {quote.status}
            </p>
            <div className="mt-2 space-y-1 text-sm text-neutral-700">
              <p>Email: {quote.email}</p>
              {quote.company ? <p>Company: {quote.company}</p> : null}
              {quote.reference ? <p>Reference: {quote.reference}</p> : null}
              {quote.notes ? <p>Notes: {quote.notes}</p> : null}
              {tokenExpiry ? <p>PDF link valid until {tokenExpiry}</p> : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href={pdfHref}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
            >
              Download PDF
            </Link>
            <QuoteActions quoteNumber={quote.quote_number} email={quote.email} issuedAt={issuedAt} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800">
          Line items
        </div>
        <div className="divide-y divide-neutral-200">
          <div className={`${lineGridClass} px-4 py-2 text-xs font-semibold uppercase text-neutral-600`}>
            <span>SKU</span>
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit</span>
            <span className="text-right">Total</span>
          </div>
          {quote.lines.map((line) => {
            const qty = Number(line.qty ?? 0);
            const unit = coerceAmount(line.unit_price_ex_vat) ?? 0;
            const total = coerceAmount(line.line_total_ex_vat) ?? unit * qty;
            return (
              <div key={line.id} className={`${lineGridClass} px-4 py-2 text-sm text-neutral-800`}>
                <span className="font-semibold break-words">{line.sku}</span>
                <span className="truncate">{line.name || line.sku}</span>
                <span className="text-right tabular-nums">{qty}</span>
                <span className="text-right tabular-nums whitespace-nowrap">{formatMoney(unit, currency)}</span>
                <span className="text-right tabular-nums whitespace-nowrap">{formatMoney(total, currency)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end border-t border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
          Subtotal (ex VAT): {formatMoney(subtotalValue, currency)}
        </div>
      </div>
    </section>
  );
}
