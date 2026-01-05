export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createQuote } from "@/lib/quotes";

const jsonResponse = (body: any, status: number) =>
  Response.json(body, { status });

type NormalizedLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
};

export async function GET() {
  return jsonResponse(
    { ok: false, error: "method_not_allowed", message: "Use POST for quotes" },
    405
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "invalid_json",
          message: "Body must be valid JSON",
        },
        400
      );
    }

    const candidateLines = Array.isArray(body?.lines)
      ? body.lines
      : Array.isArray(body?.items)
        ? body.items
        : null;

    const { email, company, reference, notes } = body || {};

    if (!email || typeof email !== "string" || !email.trim()) {
      return jsonResponse(
        { ok: false, error: "invalid_email", message: "Email is required" },
        400
      );
    }

    if (!candidateLines || !candidateLines.length) {
      return jsonResponse(
        {
          ok: false,
          error: "invalid_lines",
          message: "At least one line item is required",
        },
        400
      );
    }

    const normalizedLines: NormalizedLine[] = candidateLines.map(
      (line: any) => ({
        sku: String(line?.sku || "").trim(),
        name: String(line?.name || line?.sku || "").trim(),
        qty: Number(line?.qty),
        unit_price_ex_vat: Number(line?.unit_price_ex_vat),
      })
    );

    const invalidLine = normalizedLines.find(
      (line) =>
        !line.sku ||
        !line.name ||
        !Number.isInteger(line.qty) ||
        line.qty <= 0 ||
        !Number.isFinite(line.unit_price_ex_vat) ||
        line.unit_price_ex_vat < 0
    );

    if (invalidLine) {
      return jsonResponse(
        {
          ok: false,
          error: "invalid_lines",
          message:
            "Each line requires sku, name, qty > 0 and unit_price_ex_vat ≥ 0",
        },
        400
      );
    }

    const createQuoteInput = {
      email: String(email).trim().toLowerCase(),
      company: company ? String(company) : undefined,
      reference: reference ? String(reference) : undefined,
      notes: notes ? String(notes) : undefined,
      lines: normalizedLines,
    };

    console.log("[quotes] POST", {
      keys: Object.keys(body || {}),
      linesLen: normalizedLines.length,
    });

    try {
      const quote = await createQuote(createQuoteInput);
      return jsonResponse(
        {
          ok: true,
          quote_number: quote.quote_number,
          id: quote.id,
        },
        200
      );
    } catch (error: any) {
      console.error("[quotes] save failed", error);

      const prismaCode = error?.code;
      const prismaMeta = error?.meta;
      const message =
        prismaCode && process.env.NODE_ENV === "production"
          ? "Unable to save quote right now"
          : error?.message || "Failed to create quote";

      return jsonResponse(
        {
          ok: false,
          error: prismaCode ? "prisma_error" : "internal_error",
          message,
          prisma: prismaCode
            ? { code: prismaCode, meta: prismaMeta ?? null }
            : undefined,
          details:
            process.env.NODE_ENV !== "production"
              ? String(error?.stack || error)
              : undefined,
        },
        500
      );
    }
  } catch (error: any) {
    console.error("[quotes] unhandled error", error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Failed to create quote"
        : error?.message || "Failed to create quote";

    return jsonResponse(
      {
        ok: false,
        error: "invalid_request",
        message,
        details: String(error?.stack || error),
      },
      500
    );
  }
}
