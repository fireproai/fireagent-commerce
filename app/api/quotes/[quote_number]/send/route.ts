import { NextRequest, NextResponse } from "next/server";

import { ensureActivePublicToken, getQuoteByNumber, markQuoteIssued } from "lib/quotes";
import { computeQuoteValidity, generateQuotePdf } from "lib/quote-pdf";
import { sendQuoteEmail } from "lib/send-quote-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveParams<T extends Record<string, unknown>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

export async function POST(request: NextRequest, context: { params: Promise<{ quote_number: string }> }) {
  try {
    const resolvedParams = await resolveParams<{ quote_number: string }>(context.params);
    const emailParam = request.nextUrl.searchParams.get("e") || "";

    let quote = await getQuoteByNumber(resolvedParams.quote_number, { ensurePublicToken: true });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (!emailParam || quote.email.toLowerCase() !== emailParam.toLowerCase()) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    quote = await ensureActivePublicToken(quote);

    const { validUntil } = computeQuoteValidity(quote);
    const pdfBuffer = await generateQuotePdf(quote, { statusOverride: "issued", validUntil });
    const adminBcc = (process.env.ADMIN_EMAIL_BCC || "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
    const bcc = adminBcc.length ? adminBcc : undefined;

    const provider = await sendQuoteEmail({
      quote,
      pdfBuffer,
      validUntil,
      bcc,
    });

    await markQuoteIssued(quote.quote_number);

    return NextResponse.json({ status: "issued", provider });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[api/quotes/send] failed", error);
    const message = process.env.NODE_ENV === "production" ? "Failed to send quote" : error?.message || "Failed to send quote";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
