import { NextResponse } from "next/server";

import { getQuoteByNumber } from "lib/quotes";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { quote_number, email } = body || {};
    if (!quote_number || !email) {
      return NextResponse.json({ error: "Quote number and email are required" }, { status: 400 });
    }

    const quote = await getQuoteByNumber(String(quote_number));
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const match = quote.email.toLowerCase() === String(email).trim().toLowerCase();
    if (!match) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    return NextResponse.json({
      quote_number: quote.quote_number,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[api/quotes/lookup] failed", error);
    return NextResponse.json({ error: "Failed to lookup quote" }, { status: 500 });
  }
}
