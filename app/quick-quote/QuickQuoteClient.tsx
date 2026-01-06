"use client";

import Link from "next/link";
import React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { LINE_ITEM_GRID_TEMPLATE, LineItemRow } from "components/quick/LineItemRow";
import { Button } from "components/ui/Button";
import { Card, CardContent, CardHeader } from "components/ui/Card";
import { useCart } from "components/cart/cart-context";
import { TabsFrame } from "components/ui/TabsFrame";
import type { QuickBuilderProduct } from "lib/quick/products";

import { CataloguePicker } from "../quick-cart/CataloguePicker";

type QuoteLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
};

type QuoteSummary = {
  id: string;
  quote_number: string;
  status: string;
  created_at: string;
  issued_at: string | null;
  total_value: number;
  currency: string;
  publicToken: string | null;
  publicTokenExpiresAt: string | null;
};

type AppliedLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
  product?: QuickBuilderProduct;
};

type Props = {
  products: QuickBuilderProduct[];
  initialQuotes: QuoteSummary[];
  isLoggedIn: boolean;
};

const TAB_STORAGE_KEY = "fa_quick_quote_tab_v1";
const DRAFT_STORAGE_KEY = "fa_quote_draft_v1";

const getCartLinesArray = (cart: any): any[] => {
  if (!cart || !cart.lines) return [];
  if (Array.isArray(cart.lines)) return cart.lines;
  if (Array.isArray((cart.lines as any).nodes)) return (cart.lines as any).nodes;
  if (Array.isArray((cart.lines as any).edges)) {
    return (cart.lines as any).edges.map((e: any) => e?.node).filter(Boolean);
  }
  return [];
};

function formatCurrency(value: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    minimumFractionDigits: 2,
  });
  return formatter.format(Number.isFinite(value) ? value : 0);
}

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeTab(tab?: string | null): "quote" | "catalogue" | "summary" | "quotes" {
  if (tab === "catalogue" || tab === "summary" || tab === "quotes") return tab;
  return "quote";
}

export function QuickQuoteClient({ products, initialQuotes, isLoggedIn }: Props) {
  const searchParams = useSearchParams();
  const { cart } = useCart();
  const switchButtonClass =
    "min-w-[190px] rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100";
  const primaryButtonClass =
    "min-w-[130px] rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800";
  const lineGridBase = `grid ${LINE_ITEM_GRID_TEMPLATE} items-start gap-3`;
  const lineHeaderClass = `${lineGridBase} border-b border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800`;
  const totalsRowClass = `${lineGridBase} border-t border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700`;

  const [quoteLines, setQuoteLines] = React.useState<QuoteLine[]>([]);
  const [quoteEmail, setQuoteEmail] = React.useState("");
  const [quoteCompany, setQuoteCompany] = React.useState("");
  const [quoteReference, setQuoteReference] = React.useState("");
  const [quoteNotes, setQuoteNotes] = React.useState("");
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = React.useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [privacyChecked, setPrivacyChecked] = React.useState(false);
  const [privacyError, setPrivacyError] = React.useState<string | null>(null);
  const [loggedIn, setLoggedIn] = React.useState(isLoggedIn);
  const [quotes, setQuotes] = React.useState<QuoteSummary[]>(initialQuotes);
  const [activeTab, setActiveTab] = React.useState<"quote" | "catalogue" | "summary" | "quotes">(() => {
    const paramTab = searchParams?.get("tab");
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (stored) return normalizeTab(stored);
    }
    return normalizeTab(paramTab);
  });
  const cartLineCount = React.useMemo(() => {
    const lines = getCartLinesArray(cart);
    return lines.reduce((sum, line) => sum + Number(line?.quantity ?? 0), 0);
  }, [cart]);

  React.useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);

  React.useEffect(() => {
    setLoggedIn(isLoggedIn);
  }, [isLoggedIn]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const cookies = document.cookie || "";
    const isAuthed = /_secure_customer_sig|customer_signed_in|customerLoggedIn/i.test(cookies);
    setLoggedIn(isAuthed);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.quoteLines) setQuoteLines(parsed.quoteLines);
      if (parsed?.quoteEmail) setQuoteEmail(parsed.quoteEmail);
      if (parsed?.quoteCompany) setQuoteCompany(parsed.quoteCompany);
      if (parsed?.quoteReference) setQuoteReference(parsed.quoteReference);
      if (parsed?.quoteNotes) setQuoteNotes(parsed.quoteNotes);
      if (typeof parsed?.privacyChecked === "boolean") setPrivacyChecked(parsed.privacyChecked);
    } catch {
      // ignore hydration errors
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = setTimeout(() => {
      try {
        const payload = {
          quoteLines,
          quoteEmail,
          quoteCompany,
          quoteReference,
          quoteNotes,
          privacyChecked,
        };
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore persistence errors
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [quoteLines, quoteEmail, quoteCompany, quoteReference, quoteNotes, privacyChecked]);

  React.useEffect(() => {
    const paramTab = searchParams?.get("tab");
    if (paramTab) {
      const normalized = normalizeTab(paramTab);
      if (normalized !== activeTab) setActiveTab(normalized);
    }
  }, [searchParams, activeTab]);

  const updateTab = (tab: "quote" | "catalogue" | "summary" | "quotes") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
      window.localStorage.setItem(TAB_STORAGE_KEY, tab);
    }
  };

  const clearDraft = () => {
    setQuoteLines([]);
    setQuoteEmail("");
    setQuoteCompany("");
    setQuoteReference("");
    setQuoteNotes("");
    setPrivacyChecked(false);
    setPrivacyError(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  const applyCatalogueLines = (lines: AppliedLine[]) => {
    if (!lines.length) return;
    setQuoteLines((prev) => {
      const next = [...prev];
      lines.forEach((line) => {
        const existing = next.find((item) => item.sku === line.sku);
        const unitPrice = Number.isFinite(line.unit_price_ex_vat) ? line.unit_price_ex_vat : 0;
        if (existing) {
          existing.qty = Math.min(999, existing.qty + line.qty);
          if (unitPrice) existing.unit_price_ex_vat = unitPrice;
        } else {
          next.push({
            sku: line.sku,
            name: line.name || line.sku,
            qty: line.qty,
            unit_price_ex_vat: unitPrice,
          });
        }
      });
      return next;
    });
    toast.success(`Added ${lines.length} item(s) to quote`);
    updateTab("quote");
  };

  const setQuoteQuantity = (sku: string, nextQty: number) => {
    const safeQty = Math.max(0, Math.min(9999, Math.floor(nextQty)));
    setQuoteLines((prev) => {
      if (safeQty === 0) return prev.filter((line) => line.sku !== sku);
      return prev.map((line) => (line.sku === sku ? { ...line, qty: safeQty } : line));
    });
  };

  const removeLine = (sku: string) => {
    setQuoteLines((prev) => prev.filter((line) => line.sku !== sku));
  };

  const submitQuote = async () => {
    setQuoteError(null);
    setQuoteSuccess(null);
    setPrivacyError(null);
    if (!quoteEmail.trim()) {
      setQuoteError("Email is required.");
      return;
    }
    if (!quoteLines.length) {
      setQuoteError("Add items to the quote first.");
      return;
    }
    if (!loggedIn && !privacyChecked) {
      setPrivacyError("Please acknowledge the Privacy Policy.");
      return;
    }

    const linesPayload = quoteLines
      .filter((line) => line.qty > 0)
      .map((line) => ({
        sku: line.sku,
        name: line.name,
        qty: line.qty,
        unit_price_ex_vat: Number(line.unit_price_ex_vat.toFixed(2)),
      }));

    if (!linesPayload.length) {
      setQuoteError("Add items to the quote first.");
      return;
    }

    setQuoteLoading(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: quoteEmail.trim(),
          company: quoteCompany.trim(),
          reference: quoteReference.trim(),
          notes: quoteNotes.trim(),
          privacy_acknowledged: loggedIn ? true : privacyChecked,
          lines: linesPayload,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data?.message || data?.error || `Quote save failed (HTTP ${res.status})`;
        setQuoteError(message);
        setQuoteLoading(false);
        return;
      }

      const quoteNumber = data?.quote_number;
      if (!quoteNumber) {
        setQuoteError("Quote saved but missing reference. Please check history.");
        setQuoteLoading(false);
        return;
      }

      toast.success(`Quote ${quoteNumber} created`);
      setQuoteSuccess(`Quote ${quoteNumber} saved`);
      const totalValueLocal = linesPayload.reduce((sum, line) => sum + line.qty * line.unit_price_ex_vat, 0);
      const newQuote: QuoteSummary = {
        id: data?.id || quoteNumber,
        quote_number: quoteNumber,
        status: "draft",
        created_at: new Date().toISOString(),
        issued_at: null,
        total_value: Number(totalValueLocal.toFixed(2)),
        currency: "GBP",
        publicToken: data?.public_token ?? null,
        publicTokenExpiresAt: data?.public_token_expires_at ?? null,
      };
      setQuotes((prev) => [newQuote, ...prev]);
      setQuoteLines([]);
      setQuoteCompany("");
      setQuoteReference("");
      setQuoteNotes("");
      setPrivacyChecked(false);
      updateTab("quotes");
    } catch (err) {
      const devMessage =
        process.env.NODE_ENV !== "production"
          ? (err as Error)?.message || "Could not create quote, please try again."
          : "Could not create quote, please try again.";
      setQuoteError(devMessage);
    } finally {
      setQuoteLoading(false);
    }
  };

  const totalQty = quoteLines.reduce((sum, line) => sum + line.qty, 0);
  const totalValue = quoteLines.reduce((sum, line) => {
    const unit = Number.isFinite(line.unit_price_ex_vat) ? line.unit_price_ex_vat : 0;
    return sum + unit * line.qty;
  }, 0);
  const canSubmit =
    Boolean(quoteEmail.trim()) && quoteLines.length > 0 && !quoteLoading && (loggedIn || privacyChecked);

  const renderQuotesTab = () => {
    if (!loggedIn) {
      return (
        <Card>
          <CardContent className="space-y-2">
            <h3 className="text-lg font-semibold text-neutral-900">Login required</h3>
            <p className="text-sm text-neutral-700">
              Sign in to view your recent quotes. Need help?{" "}
              <Link href="mailto:shop@fireagent.co.uk" className="text-blue-700 hover:underline">
                Email us
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-600">Quotes</p>
            <h3 className="text-lg font-semibold text-neutral-900">Recent history</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotes.length === 0 ? <p className="text-sm text-neutral-600">No quotes yet.</p> : null}
          <div className="divide-y divide-neutral-200">
            {quotes.map((quote) => {
              const statusLabel = quote.status === "issued" ? "Issued" : "Draft";
              const statusClass =
                quote.status === "issued"
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800";
              const token = quote.publicToken;
              const pdfHref = token ? `/api/quotes/${quote.quote_number}/pdf?token=${token}` : null;
              const viewHref = token ? `/quotes/${quote.quote_number}?token=${token}` : null;
              return (
                <div key={quote.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{quote.quote_number}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      Date {formatDate(quote.created_at)} - Total {formatCurrency(quote.total_value, quote.currency)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {viewHref ? (
                      <Link
                        href={viewHref}
                        className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-100"
                      >
                        View
                      </Link>
                    ) : null}
                    {pdfHref ? (
                      <Link
                        href={pdfHref}
                        className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                      >
                        Download PDF
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-500">PDF link unavailable</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <section className="w-full space-y-2 pt-0 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Quick Quote</h1>
          <p className="text-sm text-neutral-600">Fast SKU entry for professional trade orders.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 min-w-[320px] justify-end">
          <Link href="/cart" className={primaryButtonClass}>
            Go to Cart
          </Link>
          <Link href="/quick-cart" className={switchButtonClass}>
            {cartLineCount > 0 ? "Continue in Quick Cart" : "Switch to Quick Cart"}
          </Link>
        </div>
      </div>

      <TabsFrame
        activeTab={activeTab}
        onTabChange={(tabId) => updateTab(tabId as "quote" | "catalogue" | "summary" | "quotes")}
        tabs={[
          {
            id: "quote",
            label: "Quote",
            content: (
              <div className="grid gap-4">
                <Card>
                  <CardHeader className="flex items-center justify-end pb-2">
                    <Button variant="secondary" size="sm" onClick={() => updateTab("catalogue")}>
                      Add from catalogue
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className={lineHeaderClass}>
                        <div className="grid grid-cols-[minmax(96px,auto)_minmax(0,1fr)] gap-x-3">
                          <span className="text-left text-sm font-semibold text-neutral-800">Part number</span>
                          <span className="text-left text-sm font-semibold text-neutral-800">Description</span>
                        </div>
                        <span className="text-right text-sm font-semibold text-neutral-800">Qty</span>
                        <span className="text-right text-sm font-semibold text-neutral-800">Each (ex VAT)</span>
                        <span className="text-right text-sm font-semibold text-neutral-800">Total (ex VAT)</span>
                        <span className="justify-self-end text-right text-sm font-semibold text-neutral-800">Remove</span>
                      </div>
                      <div className="divide-y divide-neutral-200">
                        {quoteLines.length === 0 ? (
                          <div className="py-3 text-sm text-neutral-600">Add items to include them in the quote.</div>
                        ) : (
                          quoteLines.map((line) => {
                            const unit = Number.isFinite(line.unit_price_ex_vat) ? line.unit_price_ex_vat : 0;
                            const lineTotal = unit * line.qty;
                            return (
                              <LineItemRow
                                key={line.sku}
                                sku={line.sku}
                                name={line.name}
                                qty={line.qty}
                                unitDisplay={unit ? formatCurrency(unit, "GBP") : "Unit price N/A"}
                                totalDisplay={formatCurrency(lineTotal, "GBP")}
                                onQtyChange={(next) => setQuoteQuantity(line.sku, next)}
                                onIncrement={() => setQuoteQuantity(line.sku, line.qty + 1)}
                                onDecrement={() => setQuoteQuantity(line.sku, line.qty - 1)}
                                onRemove={() => removeLine(line.sku)}
                              />
                            );
                          })
                        )}
                      </div>
                      <div className={totalsRowClass}>
                        <span className="text-left text-sm font-semibold text-neutral-900">Totals</span>
                        <span className="text-right text-sm font-semibold text-neutral-900 tabular-nums">{totalQty}</span>
                        <span />
                        <span className="text-right text-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(totalValue, "GBP")}
                        </span>
                        <span className="justify-self-end" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: "catalogue",
            label: "Catalogue",
            content: (
              <div className="space-y-3">
                <p className="text-sm text-neutral-700">Browse the catalogue inline. Adds stay within this quote builder.</p>
                <CataloguePicker open mode="quote" products={products} onApplyLines={applyCatalogueLines} />
              </div>
            ),
          },
          {
            id: "summary",
            label: (
              <span className="inline-flex items-center gap-2">
                Summary
                {totalQty > 0 ? (
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">{totalQty}</span>
                ) : null}
              </span>
            ),
            content: (
              <div className="grid gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-neutral-900">Summary</h3>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-neutral-700">
                      <span>Items</span>
                      <span className="font-semibold text-neutral-900">{totalQty}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-neutral-700">
                      <span>Total (ex VAT)</span>
                      <span className="font-semibold text-neutral-900">{formatCurrency(totalValue, "GBP")}</span>
                    </div>
                    {quoteError ? <p className="text-xs text-red-700">{quoteError}</p> : null}
                    {quoteSuccess ? <p className="text-xs text-green-700">{quoteSuccess}</p> : null}
                    <div className="space-y-2 pt-2">
                      <Button variant="primary" size="md" className="w-full" onClick={submitQuote} disabled={!canSubmit}>
                        {quoteLoading ? "Saving..." : "Save quote"}
                      </Button>
                      <Button variant="secondary" size="sm" className="w-full" onClick={clearDraft}>
                        Clear draft
                      </Button>
                    </div>
                    <p className="text-xs text-neutral-600">
                      Tokenised PDF links included after save. {quoteLines.length ? `${quoteLines.length} line(s) added.` : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900">Quote details</div>
                        <p className="text-xs text-neutral-600">Notes and reference stay with the quote.</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
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
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-800" htmlFor="quote-notes">
                        Notes
                      </label>
                      <textarea
                        id="quote-notes"
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.currentTarget.value)}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                        placeholder="Delivery info, alternatives, or special instructions"
                        rows={3}
                      />
                    </div>
                    {!loggedIn ? (
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
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: "quotes",
            label: "Quotes",
            content: <div className="space-y-3">{renderQuotesTab()}</div>,
          },
        ]}
      />
    </section>
  );
}
