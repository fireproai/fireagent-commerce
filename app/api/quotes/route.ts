import { NextResponse } from "next/server";

import { createQuote } from "lib/quotes";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, company, reference, notes, lines } = body || {};

    if (!email || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Email and at least one line are required" }, { status: 400 });
    }

    const normalizedLines = lines
      .map((line: any) => ({
        sku: String(line.sku || "").trim(),
        name: String(line.name || line.sku || "").trim(),
        qty: Number(line.qty || 0),
        unit_price_ex_vat: Number(line.unit_price_ex_vat || 0),
      }))
      .filter((line) => line.sku && line.qty > 0);

    if (!normalizedLines.length) {
      return NextResponse.json({ error: "At least one valid line is required" }, { status: 400 });
    }

    const quote = await createQuote({
      email: String(email).trim().toLowerCase(),
      company: company ? String(company) : undefined,
      reference: reference ? String(reference) : undefined,
      notes: notes ? String(notes) : undefined,
      lines: normalizedLines,
    });

    return NextResponse.json({
      quote_number: quote.quote_number,
      quote_date: quote.quote_date,
      subtotal_ex_vat: quote.subtotal_ex_vat,
    });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[api/quotes] failed", error);
    const message =
      process.env.NODE_ENV === "production" ? "Failed to create quote" : error?.message || "Failed to create quote";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
