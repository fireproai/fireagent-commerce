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
  lines: QuoteCreateLine[];
};

const MAX_RETRY = 3;

function formatDatePart(date: Date) {
  const y = date.getUTCFullYear().toString().slice(-2);
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}${m}${d}`;
}

export function formatQuoteNumber(date: Date, seq: number) {
  return `${formatDatePart(date)}-${`${seq}`.padStart(3, "0")}`;
}

export async function createQuote(input: QuoteCreateInput) {
  if (!input.email) throw new Error("Email is required");
  if (!input.lines?.length) throw new Error("At least one line is required");

  const now = new Date();
  const quoteDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const subtotal = input.lines.reduce((sum, line) => sum + line.qty * line.unit_price_ex_vat, 0);

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
            status: "draft",
            email: input.email.toLowerCase(),
            company: input.company || null,
            reference: input.reference || null,
            notes: input.notes || null,
            subtotal_ex_vat: new Decimal(subtotal.toFixed(2)),
            lines: {
              create: input.lines.map((line) => ({
                sku: line.sku,
                name: line.name,
                qty: line.qty,
                unit_price_ex_vat: new Decimal(line.unit_price_ex_vat.toFixed(2)),
                line_total_ex_vat: new Decimal((line.qty * line.unit_price_ex_vat).toFixed(2)),
              })),
            },
          },
          include: { lines: true },
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
