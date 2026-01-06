import { NextRequest, NextResponse } from "next/server";

import { getQuoteByNumber, validateQuoteToken } from "lib/quotes";
import { computeQuoteValidity, generateQuotePdf } from "lib/quote-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveParams<T extends Record<string, unknown>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

export async function GET(request: NextRequest, context: { params: Promise<{ quote_number: string }> }) {
  try {
    const resolvedParams = await resolveParams<{ quote_number: string }>(context.params);
    const tokenParam = request.nextUrl.searchParams.get("token") || "";

    const quote = await getQuoteByNumber(resolvedParams.quote_number, { ensurePublicToken: true });
    if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tokenValidation = validateQuoteToken(quote, tokenParam);
    if (!tokenValidation.valid) {
      const status = tokenValidation.reason === "expired" ? 403 : 401;
      return NextResponse.json({ error: "Invalid or expired token" }, { status });
    }

    const { validUntil } = computeQuoteValidity(quote);
    const buffer = await generateQuotePdf(quote, { validUntil });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quote-${quote.quote_number}.pdf"`,
      },
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[api/quotes/pdf] failed", error);
    const message = process.env.NODE_ENV === "production" ? "Failed to generate PDF" : error?.message || "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
