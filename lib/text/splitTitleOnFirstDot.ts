export function splitTitleOnFirstDot(title?: string | null): { head: string; tail: string | null } {
  const safeTitle = (title || "").trim();
  if (!safeTitle) return { head: "", tail: null };

  const dotIndex = safeTitle.indexOf(".");
  if (dotIndex === -1) {
    return { head: safeTitle, tail: null };
  }

  const head = safeTitle.slice(0, dotIndex + 1).trim();
  const tail = safeTitle.slice(dotIndex + 1).trim();
  return { head, tail: tail || null };
}
