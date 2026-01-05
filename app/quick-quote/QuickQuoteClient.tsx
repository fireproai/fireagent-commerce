"use client";

import Link from "next/link";
import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { QuickBuilder } from "components/quick/QuickBuilder";
import { Button } from "components/ui/Button";
import { Card, CardContent, CardHeader } from "components/ui/Card";
import type { QuickBuilderProduct } from "lib/quick/products";

type QuoteLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
};

type Props = {
  products: QuickBuilderProduct[];
};

export function QuickQuoteClient({ products }: Props) {
const router = useRouter();
const [quoteLines, setQuoteLines] = React.useState<QuoteLine[]>([]);
const [quoteEmail, setQuoteEmail] = React.useState("");
const [quoteCompany, setQuoteCompany] = React.useState("");
const [quoteReference, setQuoteReference] = React.useState("");
const [quoteError, setQuoteError] = React.useState<string | null>(null);
const [quoteLoading, setQuoteLoading] = React.useState(false);
const [privacyChecked, setPrivacyChecked] = React.useState(false);
const [privacyError, setPrivacyError] = React.useState<string | null>(null);
const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const draftKey = "fa_quote_draft_v1";

React.useEffect(() => {
  if (typeof document === "undefined") return;
  const cookies = document.cookie || "";
  const loggedIn = /_secure_customer_sig|customer_signed_in|customerLoggedIn/i.test(cookies);
  setIsLoggedIn(loggedIn);
}, []);

  // Hydrate draft from localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.quoteLines) setQuoteLines(parsed.quoteLines);
      if (parsed?.quoteEmail) setQuoteEmail(parsed.quoteEmail);
      if (parsed?.quoteCompany) setQuoteCompany(parsed.quoteCompany);
      if (parsed?.quoteReference) setQuoteReference(parsed.quoteReference);
      if (typeof parsed?.privacyChecked === "boolean") setPrivacyChecked(parsed.privacyChecked);
    } catch {
      // ignore hydration errors
    }
  }, []);

  // Persist draft with debounce
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = setTimeout(() => {
      try {
        const payload = {
          quoteLines,
          quoteEmail,
          quoteCompany,
          quoteReference,
          privacyChecked,
        };
        window.localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        // ignore persistence errors
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [quoteLines, quoteEmail, quoteCompany, quoteReference, privacyChecked]);

  const clearDraft = () => {
    setQuoteLines([]);
    setQuoteEmail("");
    setQuoteCompany("");
    setQuoteReference("");
    setPrivacyChecked(false);
    setPrivacyError(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
    }
  };

const handleAddToQuote = ({ product, quantity }: { product: QuickBuilderProduct; quantity: number }) => {
  const price = Number(product.price ?? 0);
  const unitPrice = Number.isFinite(price) ? price : 0;
  setQuoteLines((prev) => {
    const existing = prev.find((line) => line.sku === product.sku);
      if (existing) {
        return prev.map((line) =>
          line.sku === product.sku ? { ...line, qty: Math.min(999, line.qty + quantity) } : line,
        );
      }
      return [
        ...prev,
        {
          sku: product.sku,
          name: product.name || product.sku,
          qty: quantity,
          unit_price_ex_vat: Number(unitPrice.toFixed(2)),
        },
      ];
    });
  };

  const removeLine = (sku: string) => {
    setQuoteLines((prev) => prev.filter((line) => line.sku !== sku));
  };

  const submitQuote = async () => {
    setQuoteError(null);
    setPrivacyError(null);
    if (!quoteEmail.trim()) {
      setQuoteError("Email is required.");
      return;
    }
    if (!quoteLines.length) {
      setQuoteError("Add items to the quote first.");
      return;
    }
    if (!isLoggedIn && !privacyChecked) {
      setPrivacyError("Please acknowledge the Privacy Policy.");
      return;
    }

    setQuoteLoading(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: quoteEmail,
          company: quoteCompany,
          reference: quoteReference,
          privacy_acknowledged: isLoggedIn ? true : privacyChecked,
          lines: quoteLines,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = null;
      let text: string | null = null;
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch (e) {
          text = `json-parse-error: ${(e as Error)?.message || "unknown"}`;
        }
      } else {
        text = await res.text();
      }

      if (!res.ok) {
        const snippet = text ?? (data ? JSON.stringify(data).slice(0, 200) : "no response body");
        console.error(`Quote save failed (HTTP ${res.status})`, {
          snippet,
          body: data,
        });
        const uiMessage =
          typeof data?.error === "string"
            ? `${data.error} (HTTP ${res.status})`
            : data?.message
              ? `${data.message} (HTTP ${res.status})`
              : `Quote save failed (HTTP ${res.status}). See console for details.`;
        setQuoteError(uiMessage);
        setQuoteLoading(false);
        return;
      }

      const quoteNumber = data?.quote_number;
      if (!quoteNumber) {
        console.error("Quote save missing quote_number", { data, text });
        setQuoteError("Quote save failed (missing quote number). See console for details.");
        setQuoteLoading(false);
        return;
      }

      toast.success(`Quote ${quoteNumber} created`);
      setQuoteLines([]);
      setQuoteEmail("");
      setQuoteCompany("");
      setQuoteReference("");
      setPrivacyChecked(false);
      setQuoteLoading(false);
      clearDraft();
      router.push(`/quotes/${quoteNumber}?e=${encodeURIComponent(quoteEmail)}`);
    } catch (err) {
      const devMessage =
        process.env.NODE_ENV !== "production"
          ? (err as Error)?.message || "Could not create quote, please try again."
          : "Could not create quote, please try again.";
      console.error("Quote save error", err);
      setQuoteError(devMessage);
      setQuoteLoading(false);
    }
  };

  const totalQty = quoteLines.reduce((sum, line) => sum + line.qty, 0);
  const canSubmit =
    Boolean(quoteEmail.trim()) && quoteLines.length > 0 && !quoteLoading && (isLoggedIn || privacyChecked);

  return (
    <div className="flex w-full flex-col gap-4">
      <QuickBuilder
        products={products}
        mode="quote"
        title="Quick Quote"
        description="Build a quote without adding items to your cart. Ideal for project pricing and approvals."
        trailingHeader={
          <span className="rounded-full border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700">
            {totalQty} item{totalQty === 1 ? "" : "s"} in quote
          </span>
        }
        secondaryAction={{ href: "/quick-cart", label: "Switch to Quick Cart" }}
        onAddLine={handleAddToQuote}
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Quote details</div>
              <p className="text-xs text-neutral-600">Items added via Quick Quote.</p>
            </div>
            {/* Retrieval is login-gated separately; creation is open. */}
            <button
              type="button"
              className="text-xs font-medium text-neutral-700 underline-offset-2 hover:underline"
              onClick={clearDraft}
            >
              Clear draft
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {quoteLines.length === 0 ? (
              <div className="p-3 text-sm text-neutral-600">Add items to include them in the quote.</div>
            ) : (
              quoteLines.map((line) => (
                <div key={line.sku} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="flex flex-col">
                    <span className="font-semibold text-neutral-900">{line.sku}</span>
                    <span className="text-neutral-700">{line.name}</span>
                    <span className="text-xs text-neutral-600">
                      Qty {line.qty} @ \u00a3{line.unit_price_ex_vat.toFixed(2)} ex VAT
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeLine(line.sku)}>
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-800" htmlFor="quote-email">
                Email
              </label>
              <input
                id="quote-email"
                type="email"
                value={quoteEmail}
                onChange={(e) => setQuoteEmail(e.currentTarget.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-800" htmlFor="quote-company">
                Company
              </label>
              <input
                id="quote-company"
                value={quoteCompany}
                onChange={(e) => setQuoteCompany(e.currentTarget.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-800" htmlFor="quote-reference">
                Reference
              </label>
              <input
                id="quote-reference"
                value={quoteReference}
                onChange={(e) => setQuoteReference(e.currentTarget.value)}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                placeholder="PO / project"
              />
            </div>
          </div>

          {quoteError ? <p className="text-xs text-red-700">{quoteError}</p> : null}
          {!isLoggedIn ? (
            <label className="flex items-start gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                checked={privacyChecked}
                onChange={(e) => {
                  setPrivacyChecked(e.currentTarget.checked);
                  if (e.currentTarget.checked) setPrivacyError(null);
                }}
              />
              <span>
                I agree to the{" "}
                <Link href="/privacy" className="text-blue-700 hover:underline">
                  Privacy Policy
                </Link>{" "}
                and understand that my quote will be processed and stored by FireAgent.
              </span>
            </label>
          ) : null}
          {privacyError ? <p className="text-xs text-red-700">{privacyError}</p> : null}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={submitQuote}
              disabled={!canSubmit}
            >
              {quoteLoading ? "Creating..." : "Save quote"}
            </Button>
            <p className="text-xs text-neutral-600">
              Ex VAT totals only for now. {quoteLines.length ? `${quoteLines.length} line(s) added.` : ""}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
