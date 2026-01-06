export function formatLineTitle(rawTitle?: string | null) {
  const title = (rawTitle || "").trim();
  const dotIndex = title.indexOf(".");
  const commaIndex = title.indexOf(",");
  const splitIndex =
    dotIndex === -1
      ? commaIndex
      : commaIndex === -1
        ? dotIndex
        : Math.min(dotIndex, commaIndex);

  if (splitIndex === -1) {
    return { line1: title, line2: "" };
  }

  const line1 = title.slice(0, splitIndex).trim();
  const line2 = title.slice(splitIndex + 1).trim();

  return { line1, line2 };
}
