export function formatSkuTitle(sku: string, title?: string | null) {
  const safeSku = (sku || "").trim();
  const safeTitle = (title || "").trim();

  if (!safeTitle) {
    return { headline: safeSku, subline: undefined };
  }

  const dotIndex = safeTitle.indexOf(".");
  if (dotIndex !== -1) {
    const headPart = safeTitle.slice(0, dotIndex + 1).trim();
    const remainder = safeTitle.slice(dotIndex + 1).trim() || undefined;
    const headline = safeSku ? `${safeSku} — ${headPart}` : headPart;
    return { headline, subline: remainder };
  }

  const headline = safeSku && safeTitle ? `${safeSku} — ${safeTitle}` : safeSku || safeTitle;
  return { headline, subline: undefined };
}
