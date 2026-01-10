export type SendQuoteResult = {
  status?: string;
  provider?: string;
};

export async function sendQuote({
  quoteNumber,
  email,
  signal,
}: {
  quoteNumber: string;
  email: string;
  signal?: AbortSignal;
}): Promise<SendQuoteResult> {
  const res = await fetch(
    `/api/quotes/${encodeURIComponent(quoteNumber)}/send?e=${encodeURIComponent(email)}`,
    { method: "POST", signal },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : "Failed to send quote";
    throw new Error(message);
  }
  return data;
}
