"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { sendQuote } from "lib/client/sendQuote";

type Props = {
  quoteNumber: string;
  email: string;
  issuedAt?: Date | string | null;
};

function formatDate(value?: Date | string | null) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function QuoteActions({ quoteNumber, email, issuedAt }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    setSending(true);
    try {
      await sendQuote({ quoteNumber, email });
      toast.success(`Quote ${quoteNumber} emailed`);
      router.refresh();
    } catch (err) {
      const message = (err as Error)?.message || "Failed to send quote";
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const issuedText = formatDate(issuedAt);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
      >
        {sending ? "Sending..." : "Send quote"}
      </button>
      {issuedText ? <p className="text-xs text-neutral-600">Issued {issuedText}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
