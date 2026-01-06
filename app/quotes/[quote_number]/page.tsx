import Link from "next/link";
import { cookies } from "next/headers";

import { getQuoteByNumber, validateQuoteToken } from "lib/quotes";
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

  const subtotal = Number(quote.subtotal_ex_vat).toFixed(2);
  const pdfToken = tokenValidation.valid ? tokenParam : quote.publicToken;
  const pdfHref = `/api/quotes/${quote.quote_number}/pdf?token=${encodeURIComponent(pdfToken || "")}`;
  const mailTo = `mailto:${quote.email}?subject=Quote%20${quote.quote_number}&body=Reference:%20${encodeURIComponent(
    quote.reference || "",
  )}`;
  const issuedAt = quote.issued_at ? new Date(quote.issued_at) : null;
  const tokenExpiry = quote.publicTokenExpiresAt ? new Date(quote.publicTokenExpiresAt).toISOString().slice(0, 10) : null;

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-500">Quote</p>
            <h1 className="text-2xl font-semibold text-neutral-900">{quote.quote_number}</h1>
            <p className="text-sm text-neutral-600">
              Date: {quote.quote_date.toISOString().slice(0, 10)} | Status: {quote.status}
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
            <Link
              href={mailTo}
              className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800"
            >
              Copy email text
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800">
          Line items
        </div>
        <div className="divide-y divide-neutral-200">
          <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase text-neutral-600">
            <span className="col-span-3">SKU</span>
            <span className="col-span-5">Description</span>
            <span className="col-span-1 text-right">Qty</span>
            <span className="col-span-1 text-right">Unit</span>
            <span className="col-span-2 text-right">Total</span>
          </div>
          {quote.lines.map((line) => (
            <div key={line.id} className="grid grid-cols-12 px-4 py-2 text-sm text-neutral-800">
              <span className="col-span-3 font-semibold">{line.sku}</span>
              <span className="col-span-5">{line.name}</span>
              <span className="col-span-1 text-right">{line.qty}</span>
              <span className="col-span-1 text-right">\u00a3{Number(line.unit_price_ex_vat).toFixed(2)}</span>
              <span className="col-span-2 text-right">\u00a3{Number(line.line_total_ex_vat).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
          Subtotal (ex VAT): \u00a3{subtotal}
        </div>
      </div>
    </section>
  );
}
