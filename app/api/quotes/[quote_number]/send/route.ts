import { NextRequest, NextResponse } from "next/server";

import { ensureActivePublicToken, getQuoteByNumber, markQuoteIssuedWithRevision } from "lib/quotes";
import { computeQuoteValidity, generateQuotePdf } from "lib/quote-pdf";
import { EmailConfigError, sendQuoteEmail } from "lib/send-quote-email";
import { baseUrl as fallbackBaseUrl } from "lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveParams<T extends Record<string, unknown>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

function normalizeBaseUrl(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return fallbackBaseUrl;
  try {
    const url = new URL(raw);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.origin;
  } catch {
    return raw.replace(/\/$/, "") || fallbackBaseUrl;
  }
}

function resolveRequestBaseUrl(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  if (originHeader) return normalizeBaseUrl(originHeader);
  const protoHeader = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(/:$/, "") || "https";
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (hostHeader) return normalizeBaseUrl(`${protoHeader}://${hostHeader}`);
  return normalizeBaseUrl(fallbackBaseUrl);
}

export async function POST(request: NextRequest, context: { params: Promise<{ quote_number: string }> }) {
  try {
    const resolvedParams = await resolveParams<{ quote_number: string }>(context.params);
    const emailParam = request.nextUrl.searchParams.get("e") || "";
    console.log("[api/quotes/send] start", { quoteNumber: resolvedParams.quote_number });

    let quote = await getQuoteByNumber(resolvedParams.quote_number, { ensurePublicToken: true });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (!emailParam || quote.email.toLowerCase() !== emailParam.toLowerCase()) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    quote = await ensureActivePublicToken(quote);
    const baseRevision = typeof (quote as any).revision === "number" ? (quote as any).revision : 0;
    const nextRevision = quote.status === "issued" ? baseRevision + 1 : baseRevision;

    await markQuoteIssuedWithRevision(quote.quote_number, nextRevision);
    const refreshedQuote = await getQuoteByNumber(quote.quote_number, { ensurePublicToken: true });
    const quoteForArtifacts = refreshedQuote ? { ...refreshedQuote, revision: nextRevision } : { ...quote, revision: nextRevision };
    const requestBaseUrl = resolveRequestBaseUrl(request);

    const { validUntil } = computeQuoteValidity(quoteForArtifacts);
    const pdfBuffer = await generateQuotePdf(quoteForArtifacts, { statusOverride: "issued", validUntil });
    const adminBcc = (process.env.ADMIN_EMAIL_BCC || "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
    const bcc = adminBcc.length ? adminBcc : undefined;

    const provider = await sendQuoteEmail({
      quote: quoteForArtifacts,
      pdfBuffer,
      validUntil,
      bcc,
      baseUrl: requestBaseUrl,
    });
    console.log("[api/quotes/send] sent", { quoteNumber: quote.quote_number, provider });

    return NextResponse.json({ status: "issued", provider });
  } catch (error: any) {
    if (error instanceof EmailConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // eslint-disable-next-line no-console
    console.error("[api/quotes/send] failed", error);
    const message = process.env.NODE_ENV === "production" ? "Failed to send quote" : error?.message || "Failed to send quote";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
