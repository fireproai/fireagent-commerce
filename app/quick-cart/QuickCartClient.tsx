"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { useCart } from "components/cart/cart-context";
import { Button } from "components/ui/Button";
import { Card, CardContent, CardHeader } from "components/ui/Card";
import { canAddToCart, getAvailabilityState } from "lib/commercialState";
import type { QuickBuilderProduct } from "lib/quick/products";

import { CataloguePicker } from "./CataloguePicker";

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

type Props = {
  products: QuickBuilderProduct[];
  initialQuotes: QuoteSummary[];
  isLoggedIn: boolean;
};

type CartLine = {
  id?: string | null;
  merchandiseId: string;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  currency: string;
  handle?: string | null;
};

const TAB_STORAGE_KEY = "fa_quick_cart_tab_v1";
const FORM_STORAGE_KEY = "fa_quick_quote_form_v1";

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

function getCartLinesArray(cart: any): any[] {
  if (!cart || !cart.lines) return [];
  if (Array.isArray(cart.lines)) return cart.lines;
  if (Array.isArray((cart.lines as any).nodes)) return (cart.lines as any).nodes;
  if (Array.isArray((cart.lines as any).edges)) {
    return (cart.lines as any).edges.map((e: any) => e?.node).filter(Boolean);
  }
  return [];
}

function normalizeTab(tab?: string | null): "cart" | "quote" | "quotes" {
  if (tab === "quote" || tab === "quotes") return tab;
  return "cart";
}

function generateLocalId(fallback: string) {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return fallback;
}

function buildVariantFromLine(line: CartLine) {
  return {
    id: line.merchandiseId,
    title: line.sku,
    availableForSale: true,
    selectedOptions: [],
    price: {
      amount: line.unitPrice.toString(),
      currencyCode: line.currency || "GBP",
    },
  } as any;
}

function buildProductFromLine(line: CartLine) {
  return {
    id: line.handle || line.sku,
    handle: line.handle || line.sku,
    title: line.name || line.sku,
    featuredImage: null,
    variants: [],
  } as any;
}

export function QuickCartClient({ products, initialQuotes, isLoggedIn }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, addCartItem, updateCartItem } = useCart();

  const [activeTab, setActiveTab] = React.useState<"cart" | "quote" | "quotes">(() => {
    const paramTab = searchParams?.get("tab");
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (stored) return normalizeTab(stored);
    }
    return normalizeTab(paramTab);
  });
  const [catalogueOpen, setCatalogueOpen] = React.useState(false);
  const [catalogueMode, setCatalogueMode] = React.useState<"cart" | "quote">("cart");
  const [quoteEmail, setQuoteEmail] = React.useState("");
  const [quoteCompany, setQuoteCompany] = React.useState("");
  const [quoteReference, setQuoteReference] = React.useState("");
  const [quoteNotes, setQuoteNotes] = React.useState("");
  const [privacyChecked, setPrivacyChecked] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = React.useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [quotes, setQuotes] = React.useState<QuoteSummary[]>(initialQuotes);

  React.useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(FORM_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.quoteEmail) setQuoteEmail(parsed.quoteEmail);
      if (parsed?.quoteCompany) setQuoteCompany(parsed.quoteCompany);
      if (parsed?.quoteReference) setQuoteReference(parsed.quoteReference);
      if (parsed?.quoteNotes) setQuoteNotes(parsed.quoteNotes);
      if (typeof parsed?.privacyChecked === "boolean") setPrivacyChecked(parsed.privacyChecked);
    } catch {
      // ignore parse errors
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = setTimeout(() => {
      try {
        window.localStorage.setItem(
          FORM_STORAGE_KEY,
          JSON.stringify({
            quoteEmail,
            quoteCompany,
            quoteReference,
            quoteNotes,
            privacyChecked,
          }),
        );
      } catch {
        // ignore persistence issues
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [quoteEmail, quoteCompany, quoteReference, quoteNotes, privacyChecked]);

  React.useEffect(() => {
    const paramTab = searchParams?.get("tab");
    if (paramTab) {
      const normalized = normalizeTab(paramTab);
      if (normalized !== activeTab) setActiveTab(normalized);
    }
  }, [searchParams, activeTab]);

  const updateTab = (tab: "cart" | "quote" | "quotes") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
      window.localStorage.setItem(TAB_STORAGE_KEY, tab);
    }
  };

  const cartLines: CartLine[] = React.useMemo(() => {
    const lines = getCartLinesArray(cart);
    return lines.map((line: any) => {
      const qty = Number(line?.quantity ?? 0);
      const totalAmount = Number((line?.cost?.totalAmount?.amount as string) ?? 0);
      const currency = line?.cost?.totalAmount?.currencyCode || "GBP";
      const unitPrice = qty > 0 ? Number((totalAmount / qty).toFixed(2)) : 0;
      return {
        id: line?.id ?? null,
        merchandiseId: line?.merchandise?.id ?? line?.merchandiseId ?? line?.id ?? "",
        sku: line?.merchandise?.title || line?.sku || line?.id || "SKU",
        name: line?.merchandise?.product?.title || line?.merchandise?.title || line?.title || line?.sku || "Item",
        qty: qty > 0 ? qty : 0,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        lineTotal: Number.isFinite(totalAmount) ? Number(totalAmount.toFixed(2)) : 0,
        currency,
        handle: line?.merchandise?.product?.handle ?? line?.handle ?? null,
      };
    });
  }, [cart]);

  const cartTotals = React.useMemo(() => {
    const totalQty = cartLines.reduce((sum, line) => sum + line.qty, 0);
    const currency = cartLines[0]?.currency || "GBP";
    const totalValue = cartLines.reduce((sum, line) => sum + (line.lineTotal || 0), 0);
    return { totalQty, totalValue, currency };
  }, [cartLines]);

  const handleAddProduct = async (product: QuickBuilderProduct) => {
    const availability = getAvailabilityState({
      merchandiseId: product.merchandiseId,
      requiresQuote: product.requires_quote,
      discontinued: false,
    });
    const canProceed = catalogueMode === "quote" ? availability !== "discontinued" : canAddToCart(availability);
    if (!canProceed) {
      toast.error("This item is not available for quick add.");
      return;
    }
    const variant = {
      id: product.merchandiseId ?? product.sku,
      title: product.sku,
      availableForSale: true,
      selectedOptions: [],
      price: {
        amount: (product.price ?? 0).toString(),
        currencyCode: "GBP",
      },
    } as any;
    const minimalProduct = {
      id: product.handle ?? product.sku,
      handle: product.handle ?? product.sku,
      title: product.name || product.sku,
      featuredImage: null,
      variants: [],
    } as any;
    await Promise.resolve(addCartItem(variant, minimalProduct, 1));
    toast.success(`Added ${product.sku}`);
  };

  const setCartQuantity = (line: CartLine, nextQty: number) => {
    if (!line.merchandiseId) {
      toast.error("Unable to update this line");
      return;
    }
    const safeQty = Math.max(0, Math.min(999, Math.floor(nextQty)));
    if (safeQty === line.qty) return;
    if (safeQty === 0) {
      updateCartItem(line.merchandiseId, "delete");
      return;
    }
    if (safeQty > line.qty) {
      const diff = safeQty - line.qty;
      const variant = buildVariantFromLine(line);
      const productPayload = buildProductFromLine(line);
      addCartItem(variant, productPayload, diff);
    } else {
      const diff = line.qty - safeQty;
      for (let i = 0; i < diff; i += 1) {
        updateCartItem(line.merchandiseId, "minus");
      }
    }
  };

  const removeCartLine = (line: CartLine) => {
    if (!line.merchandiseId) return;
    updateCartItem(line.merchandiseId, "delete");
  };

  const submitQuote = async () => {
    setQuoteError(null);
    setQuoteSuccess(null);
    if (!quoteEmail.trim()) {
      setQuoteError("Email is required.");
      return;
    }
    if (!cartLines.length) {
      setQuoteError("Add items to your cart to build a quote.");
      return;
    }
    if (!isLoggedIn && !privacyChecked) {
      setQuoteError("Please acknowledge the Privacy Policy.");
      return;
    }

    setQuoteLoading(true);
    try {
      const linesPayload = cartLines
        .filter((line) => line.qty > 0)
        .map((line) => ({
          sku: line.sku,
          name: line.name,
          qty: line.qty,
          unit_price_ex_vat: Number(line.unitPrice.toFixed(2)),
        }));
      if (!linesPayload.length) {
        setQuoteError("Add items to your cart to build a quote.");
        setQuoteLoading(false);
        return;
      }

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: quoteEmail.trim(),
          company: quoteCompany.trim(),
          reference: quoteReference.trim(),
          notes: quoteNotes.trim(),
          privacy_acknowledged: isLoggedIn ? true : privacyChecked,
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
      const publicToken = data?.public_token;
      if (quoteNumber) {
        toast.success(`Quote ${quoteNumber} created`);
        setQuoteSuccess(`Quote ${quoteNumber} saved`);
        if (publicToken) {
          const newQuote: QuoteSummary = {
            id: data?.id || generateLocalId(quoteNumber),
            quote_number: quoteNumber,
            status: "draft",
            created_at: new Date().toISOString(),
            issued_at: null,
            total_value: cartTotals.totalValue,
            currency: cartTotals.currency,
            publicToken,
            publicTokenExpiresAt: data?.public_token_expires_at ?? null,
          };
          setQuotes((prev) => [newQuote, ...prev]);
        }
        updateTab("quotes");
        router.refresh();
      } else {
        setQuoteError("Quote saved but missing reference. Please check history.");
      }
      setQuoteLoading(false);
    } catch (err) {
      const devMessage =
        process.env.NODE_ENV !== "production"
          ? (err as Error)?.message || "Could not create quote, please try again."
          : "Could not create quote, please try again.";
      setQuoteError(devMessage);
      setQuoteLoading(false);
    }
  };

  const renderCartLines = (showControls: boolean) => {
    if (!cartLines.length) {
      return <p className="text-sm text-neutral-600">Your cart is empty. Use &ldquo;Add from catalogue&rdquo; to begin.</p>;
    }
    return (
      <div className="divide-y divide-neutral-200">
        {cartLines.map((line) => (
          <div key={`${line.merchandiseId}-${line.sku}`} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{line.sku}</p>
              <p className="text-sm text-neutral-700">{line.name}</p>
              <p className="text-xs text-neutral-600">
                {formatCurrency(line.unitPrice, line.currency)} each • Qty {line.qty} •{" "}
                {formatCurrency(line.lineTotal, line.currency)} total
              </p>
            </div>
            {showControls ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={line.qty}
                  onChange={(e) => setCartQuantity(line, Number(e.currentTarget.value))}
                  className="w-20 rounded-md border border-neutral-200 px-2 py-1 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                />
                <div className="flex items-center rounded-md border border-neutral-200">
                  <button
                    type="button"
                    className="px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
                    onClick={() => setCartQuantity(line, line.qty - 1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
                    onClick={() => setCartQuantity(line, line.qty + 1)}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-red-700 hover:text-red-800"
                  onClick={() => removeCartLine(line)}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  const renderQuotesTab = () => {
    if (!isLoggedIn) {
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
          <button
            type="button"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
            onClick={() => router.refresh()}
          >
            Refresh
          </button>
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
              const pdfHref = token
                ? `/api/quotes/${quote.quote_number}/pdf?token=${token}`
                : null;
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
                      Date {formatDate(quote.created_at)} • Total {formatCurrency(quote.total_value, quote.currency)}
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
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-600">Quick cart</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Simpro-style builder</h1>
          <p className="text-sm text-neutral-600">Add items fast, build quotes, and download PDFs with token links.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
          >
            Go to cart
          </Link>
          <button
            type="button"
            onClick={() => {
              setCatalogueMode("cart");
              setCatalogueOpen(true);
            }}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Add from catalogue
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        {[
          { id: "cart", label: "Cart" },
          { id: "quote", label: "Quote" },
          { id: "quotes", label: "Quotes" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateTab(tab.id as "cart" | "quote" | "quotes")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold border-b-2 ${
                isActive
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "cart" ? (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="lg:col-span-1">
            <CardHeader className="flex items-center justify-between pb-2">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Cart lines</h2>
                <p className="text-sm text-neutral-600">Keep your basket in sync while you add.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCatalogueMode("cart");
                  setCatalogueOpen(true);
                }}
              >
                Add from catalogue
              </Button>
            </CardHeader>
            <CardContent>{renderCartLines(true)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-lg font-semibold text-neutral-900">Summary</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm text-neutral-700">
                <span>Items</span>
                <span className="font-semibold text-neutral-900">{cartTotals.totalQty}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-neutral-700">
                <span>Total (ex VAT)</span>
                <span className="font-semibold text-neutral-900">
                  {formatCurrency(cartTotals.totalValue, cartTotals.currency)}
                </span>
              </div>
              <p className="text-xs text-neutral-600">
                Add items from the catalogue on the left. Prices shown are ex VAT. Checkout from the main cart when ready.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "quote" ? (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader className="flex items-center justify-between pb-2">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Quote lines</h2>
                <p className="text-sm text-neutral-600">Uses your current cart quantities.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCatalogueMode("quote");
                  setCatalogueOpen(true);
                }}
              >
                Add from catalogue
              </Button>
            </CardHeader>
            <CardContent>{renderCartLines(true)}</CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-lg font-semibold text-neutral-900">Quote details</h3>
              <p className="text-sm text-neutral-600">Reference and notes stay with the quote.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700" htmlFor="quote-email">
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
                <label className="text-xs font-medium text-neutral-700" htmlFor="quote-company">
                  Company (optional)
                </label>
                <input
                  id="quote-company"
                  value={quoteCompany}
                  onChange={(e) => setQuoteCompany(e.currentTarget.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700" htmlFor="quote-reference">
                  Reference / Notes
                </label>
                <textarea
                  id="quote-reference"
                  value={quoteReference}
                  onChange={(e) => setQuoteReference(e.currentTarget.value)}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                  placeholder="PO, project, or internal ref"
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700" htmlFor="quote-notes">
                  Additional notes
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
              {!isLoggedIn ? (
                <label className="flex items-start gap-2 text-sm text-neutral-800">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    checked={privacyChecked}
                    onChange={(e) => setPrivacyChecked(e.currentTarget.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <Link href="/privacy" className="text-blue-700 hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
              ) : null}
              {quoteError ? <p className="text-xs text-red-700">{quoteError}</p> : null}
              {quoteSuccess ? <p className="text-xs text-green-700">{quoteSuccess}</p> : null}
              <Button variant="primary" size="md" onClick={submitQuote} disabled={quoteLoading}>
                {quoteLoading ? "Saving..." : "Save quote"}
              </Button>
              <p className="text-xs text-neutral-600">
                After saving, we’ll email a tokenised PDF link (no login required). Contact shop@fireagent.co.uk for changes.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "quotes" ? renderQuotesTab() : null}

      <CataloguePicker
        open={catalogueOpen}
        mode={catalogueMode}
        products={products}
        onAdd={handleAddProduct}
        onClose={() => setCatalogueOpen(false)}
      />
    </section>
  );
}
