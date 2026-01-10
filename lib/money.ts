export const MONEY_FALLBACK_CURRENCY = "GBP";

function normalizeMoneyString(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/\\u00a3/gi, "£")
    .replace(/u00a3/gi, "£")
    .replace(/\u00a3/g, "£")
    .replace(/,/g, "");
}

export function coerceAmount(input: unknown): number | null {
  if (input === null || input === undefined) return null;

  if (typeof input === "number") {
    return Number.isFinite(input) ? input : null;
  }

  if (typeof input === "string") {
    const normalized = normalizeMoneyString(input);
    if (!normalized) return null;
    const numericPart = normalized.replace(/[^0-9.-]/g, "");
    const numeric = Number.parseFloat(numericPart);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (typeof (input as any)?.toString === "function") {
    const str = (input as any).toString();
    if (typeof str === "string" && str !== "[object Object]") {
      return coerceAmount(str);
    }
  }

  return null;
}

export function formatMoney(
  amount: number,
  currency: string,
  locale: string = "en-GB"
): string {
  const numeric = Number(amount);
  const safeAmount = Number.isFinite(numeric) ? numeric : 0;
  const currencyCode = (currency || MONEY_FALLBACK_CURRENCY).trim() || MONEY_FALLBACK_CURRENCY;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}
