import { splitTitleOnFirstDot } from "./text/splitTitleOnFirstDot";

export function formatSkuTitle(sku: string, title?: string | null) {
  const safeSku = (sku || "").trim();
  const { head, tail } = splitTitleOnFirstDot(title);

  if (!head) {
    return { headline: safeSku, subline: undefined };
  }

  const headline = safeSku ? `${safeSku} ƒ?" ${head}` : head;
  return { headline, subline: tail || undefined };
}
