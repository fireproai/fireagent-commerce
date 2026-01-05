export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

function buildResponse(body: any, status: number) {
  return NextResponse.json(body, { status });
}

export async function GET() {
  return buildResponse({ ok: true }, 200);
}

export async function POST(request: Request) {
  if (request.method !== "POST") {
    return buildResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return buildResponse({ ok: false, error: "invalid_json" }, 400);
    }

    const { email, company, reference, notes } = body || {};
    const candidateLines = Array.isArray(body?.lines)
      ? body.lines
      : Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body?.cartItems)
          ? body.cartItems
          : null;

    if (!email || !candidateLines || !candidateLines.length) {
      return buildResponse({ ok: false, error: "Email and at least one line are required" }, 400);
    }

    const normalizedLines = candidateLines
      .map((line: any) => ({
        sku: String(line.sku || "").trim(),
        name: String(line.name || line.sku || "").trim(),
        qty: Number(line.qty || 0),
        unit_price_ex_vat: Number(line.unit_price_ex_vat || 0),
      }))
      .filter((line: { sku: string; qty: number }) => line.sku && line.qty > 0);

    if (!normalizedLines.length) {
      return buildResponse({ ok: false, error: "At least one valid line is required" }, 400);
    }

    const { createQuote } = await import("lib/quotes");

    const quote = await createQuote({
      email: String(email).trim().toLowerCase(),
      company: company ? String(company) : undefined,
      reference: reference ? String(reference) : undefined,
      notes: notes ? String(notes) : undefined,
      lines: normalizedLines,
    });

    return buildResponse({
      ok: true,
      quote_number: quote.quote_number,
      quote_date: quote.quote_date,
      subtotal_ex_vat: quote.subtotal_ex_vat,
    }, 200);
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[quotes] save failed", error);
    const message =
      process.env.NODE_ENV === "production" ? "Failed to create quote" : error?.message || "Failed to create quote";
    return buildResponse(
      {
        ok: false,
        error: "internal_error",
        message,
        details: process.env.NODE_ENV !== "production" ? String(error?.stack || error) : undefined,
      },
      500,
    );
  }
}
