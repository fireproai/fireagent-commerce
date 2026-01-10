import { randomBytes } from "crypto";

import type { Prisma, Quote, QuoteLine } from "@prisma/client";
import { QuoteStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "./prisma";
import { getStoreCurrency } from "./shopify/storeCurrency";

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

export type QuoteUpdateInput = QuoteCreateInput;

const MAX_RETRY = 3;
export const PUBLIC_QUOTE_TOKEN_TTL_DAYS = 14;

function generatePublicToken() {
  return randomBytes(24).toString("hex");
}

function computePublicTokenExpiry(baseDate: Date = new Date(), ttlDays = PUBLIC_QUOTE_TOKEN_TTL_DAYS) {
  const expiry = new Date(baseDate);
  expiry.setDate(expiry.getDate() + ttlDays);
  return expiry;
}

function parseDate(value: Date | string) {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
            revision: 0,
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

export async function updateQuote(quote_number: string, input: QuoteUpdateInput): Promise<QuoteWithLines> {
  if (!quote_number) throw new Error("Quote number is required");
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

  const existing = await prisma.quote.findUnique({
    where: { quote_number },
    include: { lines: true },
  });
  if (!existing) throw new Error("Quote not found");

  const subtotal = normalizedLines.reduce((sum, line) => sum + line.line_total_ex_vat, 0);
  const privacyAcknowledgedAt =
    privacyAcknowledged && !existing.privacy_acknowledged ? new Date() : existing.privacy_acknowledged_at || null;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.quoteLine.deleteMany({ where: { quoteId: existing.id } });
    const result = await tx.quote.update({
      where: { id: existing.id },
      data: {
        email: input.email.toLowerCase(),
        company: input.company || null,
        reference: input.reference || null,
        notes: input.notes || null,
        subtotal_ex_vat: new Decimal(subtotal.toFixed(2)),
        privacy_acknowledged: existing.privacy_acknowledged || privacyAcknowledged,
        privacy_acknowledged_at: privacyAcknowledgedAt,
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
      include: { lines: true },
    });
    return result;
  });

  return updated;
}

export async function getQuoteByNumber(quote_number: string, options?: { ensurePublicToken?: boolean }) {
  if (!quote_number) return null;
  const quote = await prisma.quote.findUnique({
    where: { quote_number },
    include: { lines: true },
  });
  if (!quote) return null;

  if (options?.ensurePublicToken && (!quote.publicToken || !quote.publicTokenExpiresAt)) {
    const refreshed = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        publicToken: quote.publicToken || generatePublicToken(),
        publicTokenExpiresAt: quote.publicTokenExpiresAt || computePublicTokenExpiry(new Date()),
      },
      include: { lines: true },
    });
    return refreshed;
  }

  return quote;
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

export async function markQuoteIssuedWithRevision(quote_number: string, revision: number) {
  if (!quote_number) throw new Error("Quote number is required");
  return prisma.quote.update({
    where: { quote_number },
    data: {
      status: QuoteStatus.issued,
      issued_at: new Date(),
      revision,
    },
  });
}

export function validateQuoteToken(
  quote: Pick<Quote, "publicToken" | "publicTokenExpiresAt">,
  token?: string | null,
): { valid: boolean; reason?: "missing_token" | "missing_quote_token" | "mismatch" | "expired" | "invalid_expiry" } {
  if (!token) return { valid: false, reason: "missing_token" };
  if (!quote.publicToken || !quote.publicTokenExpiresAt) return { valid: false, reason: "missing_quote_token" };
  if (token !== quote.publicToken) return { valid: false, reason: "mismatch" };

  const expiry = parseDate(quote.publicTokenExpiresAt);
  if (!expiry) return { valid: false, reason: "invalid_expiry" };
  if (Date.now() > expiry.getTime()) return { valid: false, reason: "expired" };

  return { valid: true };
}

export async function ensureActivePublicToken<T extends Quote | QuoteWithLines>(
  quote: T,
  options?: { ttlDays?: number },
): Promise<T> {
  const expiry = quote.publicTokenExpiresAt ? parseDate(quote.publicTokenExpiresAt as any) : null;
  const needsRefresh = !quote.publicToken || !expiry || expiry.getTime() <= Date.now();
  if (!needsRefresh) return quote;

  const refreshed = await prisma.quote.update({
    where: { id: quote.id },
    data: {
      publicToken: generatePublicToken(),
      publicTokenExpiresAt: computePublicTokenExpiry(new Date(), options?.ttlDays ?? PUBLIC_QUOTE_TOKEN_TTL_DAYS),
    },
    include: { lines: true },
  });

  return refreshed as T;
}

type QuoteFilters = {
  status?: QuoteStatus | "all";
  search?: string | null;
  limit?: number;
};

function computeTotals(quote: QuoteWithLines, currency: string) {
  const storedSubtotal = quote.subtotal_ex_vat ? Number(quote.subtotal_ex_vat) : null;
  const subtotal =
    storedSubtotal !== null && Number.isFinite(storedSubtotal)
      ? storedSubtotal
      : quote.lines.reduce((sum, line) => sum + Number(line.line_total_ex_vat ?? 0), 0);
  return { total_value: Number(subtotal.toFixed(2)), currency };
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

  const storeCurrency = await getStoreCurrency();

  return quotes.map((quote) => ({
    ...quote,
    ...computeTotals(quote, storeCurrency),
  }));
}
