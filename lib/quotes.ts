import type { Prisma, Quote, QuoteLine } from "@prisma/client";
import { QuoteStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "./prisma";

export type QuoteCreateLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
};

export type QuoteCreateInput = {
  email: string;
  company?: string;
  reference?: string;
  notes?: string;
  privacy_acknowledged?: boolean;
  lines: QuoteCreateLine[];
};

const MAX_RETRY = 3;

type NormalizedQuoteLine = QuoteCreateLine & { line_total_ex_vat: number };
type QuoteWithLines = Prisma.QuoteGetPayload<{ include: { lines: true } }>;

function formatDatePart(date: Date) {
  const y = date.getUTCFullYear().toString().slice(-2);
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}${m}${d}`;
}

export function formatQuoteNumber(date: Date, seq: number) {
  return `${formatDatePart(date)}-${`${seq}`.padStart(3, "0")}`;
}

export async function createQuote(input: QuoteCreateInput): Promise<QuoteWithLines> {
  if (!input.email || typeof input.email !== "string") throw new Error("Email is required");
  if (!input.lines?.length) throw new Error("At least one line is required");

  const privacyAcknowledged = Boolean(input.privacy_acknowledged);

  const normalizedLines: NormalizedQuoteLine[] = input.lines.map((line, idx) => {
    const sku = String(line?.sku || "").trim();
    const name = String(line?.name || line?.sku || "").trim();
    const qty = Number(line?.qty);
    const unitPrice = Number((line as any)?.unit_price_ex_vat);

    const invalidQty = !Number.isInteger(qty) || qty <= 0;
    const invalidUnitPrice = Number.isNaN(unitPrice) || !Number.isFinite(unitPrice) || unitPrice < 0;

    if (!sku || !name || invalidQty || invalidUnitPrice) {
      throw new Error(`Invalid line at position ${idx + 1}: require sku, name, qty>0 and unit_price_ex_vat>=0`);
    }

    const safeUnitPrice = Number(unitPrice.toFixed(2));
    const lineTotal = Number((qty * safeUnitPrice).toFixed(2));

    return {
      sku,
      name,
      qty,
      unit_price_ex_vat: safeUnitPrice,
      line_total_ex_vat: lineTotal,
    };
  });

  const now = new Date();
  const quoteDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const subtotal = normalizedLines.reduce((sum, line) => sum + line.line_total_ex_vat, 0);

  let attempt = 0;
  while (attempt < MAX_RETRY) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const agg = await tx.quote.aggregate({
          where: { quote_date: quoteDate },
          _max: { daily_seq: true },
        });
        const nextSeq = (agg._max.daily_seq ?? 0) + 1;
        const quote_number = formatQuoteNumber(quoteDate, nextSeq);

        const created = await tx.quote.create({
          data: {
            quote_number,
            quote_date: quoteDate,
            daily_seq: nextSeq,
            status: QuoteStatus.draft,
            email: input.email.toLowerCase(),
            company: input.company || null,
            reference: input.reference || null,
            notes: input.notes || null,
            privacy_acknowledged: privacyAcknowledged,
            privacy_acknowledged_at: privacyAcknowledged ? new Date() : null,
            subtotal_ex_vat: new Decimal(subtotal.toFixed(2)),
            lines: {
              create: normalizedLines.map((line) => ({
                sku: line.sku,
                name: line.name,
                qty: line.qty,
                unit_price_ex_vat: new Decimal(line.unit_price_ex_vat.toFixed(2)),
                line_total_ex_vat: new Decimal(line.line_total_ex_vat.toFixed(2)),
              })),
            },
          },
          include: {
            lines: true,
          },
        });

        return created;
      });

      return result;
    } catch (error: any) {
      const code = error?.code || error?.meta?.cause;
      if (code === "P2002") {
        attempt += 1;
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to allocate quote number, please retry");
}

export async function getQuoteByNumber(quote_number: string) {
  if (!quote_number) return null;
  return prisma.quote.findUnique({
    where: { quote_number },
    include: { lines: true },
  });
}

export async function markQuoteIssued(quote_number: string) {
  if (!quote_number) throw new Error("Quote number is required");
  return prisma.quote.update({
    where: { quote_number },
    data: {
      status: QuoteStatus.issued,
      issued_at: new Date(),
    },
  });
}

type QuoteFilters = {
  status?: QuoteStatus | "all";
  search?: string | null;
  limit?: number;
};

function computeTotals(quote: QuoteWithLines) {
  const storedSubtotal = quote.subtotal_ex_vat ? Number(quote.subtotal_ex_vat) : null;
  const subtotal =
    storedSubtotal !== null && Number.isFinite(storedSubtotal)
      ? storedSubtotal
      : quote.lines.reduce((sum, line) => sum + Number(line.line_total_ex_vat ?? 0), 0);
  return { total_value: Number(subtotal.toFixed(2)), currency: "GBP" };
}

export async function getRecentQuotes(filters: QuoteFilters = {}) {
  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 200;
  const search = (filters.search || "").trim();
  const status = filters.status && filters.status !== "all" ? filters.status : null;

  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { quote_number: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  const quotes = await prisma.quote.findMany({
    where,
    orderBy: { created_at: "desc" },
    include: { lines: true },
    take: limit,
  });

  return quotes.map((quote) => ({
    ...quote,
    ...computeTotals(quote),
  }));
}
