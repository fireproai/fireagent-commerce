"use client";

import { useRouter } from "next/navigation";
import React from "react";

export function QuotesLookupClient() {
  const router = useRouter();
  const [quoteNumber, setQuoteNumber] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/quotes/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_number: quoteNumber.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Quote not found");
        setLoading(false);
        return;
      }
      router.push(`/quotes/${data.quote_number}?e=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setError("Lookup failed, please try again.");
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Find your quote</h1>
        <p className="text-sm text-neutral-600">Enter the quote number and your email to view.</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="quote-number" className="text-sm font-medium text-neutral-800">
              Quote number
            </label>
            <input
              id="quote-number"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.currentTarget.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
              placeholder="YYMMDD-001"
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="quote-email" className="text-sm font-medium text-neutral-800">
              Email
            </label>
            <input
              id="quote-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
              placeholder="you@example.com"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? "Checking..." : "Lookup quote"}
          </button>
        </form>
      </div>
    </section>
  );
}
