export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { updateQuote, getQuoteByNumber } from "@/lib/quotes";

function jsonResponse(body: any, status: number) {
  return NextResponse.json(body, { status });
}

type NormalizedLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
};

function normalizeLines(candidateLines: any): NormalizedLine[] | null {
  if (!candidateLines || !Array.isArray(candidateLines)) return null;
  return candidateLines.map((line: any) => ({
    sku: String(line?.sku || "").trim(),
    name: String(line?.name || line?.sku || "").trim(),
    qty: Number(line?.qty),
    unit_price_ex_vat: Number(line?.unit_price_ex_vat),
  }));
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ quote_number: string }> },
) {
  try {
    const { quote_number } = await context.params;
    const quoteNumber = quote_number;
    if (!quoteNumber) {
      return jsonResponse({ ok: false, error: "invalid_quote_number", message: "Quote number required" }, 400);
    }

    const existing = await getQuoteByNumber(quoteNumber);
    if (!existing) {
      return jsonResponse({ ok: false, error: "not_found", message: "Quote not found" }, 404);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonResponse({ ok: false, error: "invalid_json", message: "Body must be valid JSON" }, 400);
    }

    const { email, company, reference, notes } = body || {};
    const lines = normalizeLines(body?.lines ?? body?.items);

    if (!email || typeof email !== "string" || !email.trim()) {
      return jsonResponse({ ok: false, error: "invalid_email", message: "Email is required" }, 400);
    }
    if (!lines || !lines.length) {
      return jsonResponse(
        { ok: false, error: "invalid_lines", message: "At least one line item is required" },
        400,
      );
    }

    const invalidLine = lines.find(
      (line) =>
        !line.sku ||
        !line.name ||
        !Number.isInteger(line.qty) ||
        line.qty <= 0 ||
        !Number.isFinite(line.unit_price_ex_vat) ||
        line.unit_price_ex_vat < 0,
    );
    if (invalidLine) {
      return jsonResponse(
        { ok: false, error: "invalid_lines", message: "Each line requires sku, name, qty > 0 and unit_price_ex_vat >= 0" },
        400,
      );
    }

    try {
      const updated = await updateQuote(quoteNumber, {
        email: String(email).trim().toLowerCase(),
        company: company ? String(company) : undefined,
        reference: reference ? String(reference) : undefined,
        notes: notes ? String(notes) : undefined,
        privacy_acknowledged: Boolean(body?.privacy_acknowledged),
        lines,
      });

      return jsonResponse(
        {
          ok: true,
          quote_number: updated.quote_number,
          id: updated.id,
          status: updated.status,
          public_token: updated.publicToken,
          public_token_expires_at: updated.publicTokenExpiresAt,
          revision: (updated as any).revision ?? 0,
        },
        200,
      );
    } catch (error: any) {
      const message =
        process.env.NODE_ENV === "production"
          ? "Unable to update quote"
          : error?.message || "Unable to update quote";
      return jsonResponse(
        {
          ok: false,
          error: "update_failed",
          message,
          details: process.env.NODE_ENV !== "production" ? String(error?.stack || error) : undefined,
        },
        500,
      );
    }
  } catch (error: any) {
    const message =
      process.env.NODE_ENV === "production"
        ? "Failed to update quote"
        : error?.message || "Failed to update quote";
    return jsonResponse({ ok: false, error: "invalid_request", message }, 500);
  }
}
