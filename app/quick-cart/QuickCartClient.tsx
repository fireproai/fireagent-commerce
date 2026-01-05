"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { useCart } from "components/cart/cart-context";
import { Card, CardContent, CardHeader } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { ProductImage } from "components/ui/ProductImage";
import { canAddToCart, getAvailabilityState } from "lib/commercialState";

type QuickCartProduct = {
  sku: string;
  name: string;
  price?: number | null;
  handle?: string | null;
  merchandiseId?: string | null;
  requires_quote?: boolean | null;
};

type Props = {
  products: QuickCartProduct[];
};

function formatPrice(price?: number | null) {
  if (price === null || price === undefined) return "Login to see price";
  const value = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(value)) return "Login to see price";
  return `\u00a3${value.toFixed(2)}`;
}

function scoreProduct(product: QuickCartProduct, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const sku = product.sku.toLowerCase();
  const name = product.name.toLowerCase();
  if (sku === q) return 300;
  if (sku.startsWith(q)) return 200;
  if (sku.includes(q)) return 150;
  if (name.startsWith(q)) return 120;
  if (name.includes(q)) return 100;
  return 0;
}

export function QuickCartClient({ products }: Props) {
  const router = useRouter();
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const qtyRef = React.useRef<HTMLInputElement | null>(null);
  const { addCartItem, cart } = useCart();

  const [pendingQuery, setPendingQuery] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [quantity, setQuantity] = React.useState("1");
  const [message, setMessage] = React.useState<string | null>(null);
  const [hasAdded, setHasAdded] = React.useState(false);
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [quoteEmail, setQuoteEmail] = React.useState("");
  const [quoteCompany, setQuoteCompany] = React.useState("");
  const [quoteReference, setQuoteReference] = React.useState("");
  const [quoteError, setQuoteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    searchRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setQuery(pendingQuery), 150);
    return () => clearTimeout(t);
  }, [pendingQuery]);

  const results = React.useMemo(() => {
    const base = products.map((product) => ({
      ...product,
      _score: scoreProduct(product, query),
    }));

    const sorted = base
      .sort((a, b) => b._score - a._score || a.sku.localeCompare(b.sku))
      .filter((p) => (query ? p._score > 0 : true));

    if (!query) return sorted.slice(0, 15);
    return sorted.slice(0, 20);
  }, [products, query]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, query]);

  const selectedProduct = results[selectedIndex] ?? results[0] ?? null;

  const handleSelect = (index: number) => {
    if (!results.length) return;
    const clampedIndex = Math.max(0, Math.min(index, results.length - 1));
    setSelectedIndex(clampedIndex);
    setQuantity("1");
    requestAnimationFrame(() => {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    });
  };

  const handleAdd = () => {
    if (!selectedProduct) return;
    const merchandiseId = selectedProduct.merchandiseId;
    const requiresQuote = Boolean(selectedProduct.requires_quote);
    const availability = getAvailabilityState({
      merchandiseId,
      requiresQuote,
      discontinued: false,
    });
    const canAdd = canAddToCart(availability);
    const normalizedQty = Math.max(1, Math.min(999, parseInt(quantity || "1", 10) || 1));

    if (!canAdd) {
      setMessage(`SKU ${selectedProduct.sku} is unavailable for quick add`);
      searchRef.current?.focus();
      searchRef.current?.select();
      return;
    }

    const variant = {
      id: merchandiseId,
      title: selectedProduct.sku,
      availableForSale: true,
      selectedOptions: [],
      price: { amount: (selectedProduct.price ?? 0).toString(), currencyCode: "GBP" },
    } as any;

    const minimalProduct = {
      id: selectedProduct.handle ?? selectedProduct.sku,
      handle: selectedProduct.handle ?? selectedProduct.sku,
      title: selectedProduct.name || selectedProduct.sku,
      featuredImage: null,
      variants: [],
    } as any;

    addCartItem(variant, minimalProduct, normalizedQty);
    toast.success(`Added ${normalizedQty} x ${selectedProduct.sku}`);
    setHasAdded(true);
    setMessage(`Added ${normalizedQty} x ${selectedProduct.sku}`);
    setQuantity("1");
    setPendingQuery("");
    setQuery("");
    setSelectedIndex(0);
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  const onQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
  };

  const submitQuote = async () => {
    setQuoteError(null);
    const lines =
      cart?.lines?.map((line) => {
        const qty = line.quantity || 0;
        const total = Number(line.cost.totalAmount.amount || 0);
        const unit = qty > 0 ? total / qty : 0;
        return {
          sku: line.merchandise.title || line.merchandise.id,
          name: line.merchandise.product?.title || line.merchandise.title || "",
          qty,
          unit_price_ex_vat: unit,
        };
      }) || [];

    if (!quoteEmail.trim()) {
      setQuoteError("Email is required.");
      return;
    }
    if (!lines.length) {
      setQuoteError("Add items to the cart first.");
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
          lines,
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
        const snippet =
          text ??
          (data ? JSON.stringify(data).slice(0, 200) : "no response body");
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

  return (
    <section className="flex w-full flex-col gap-4">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-neutral-900">Quick Cart</h1>
              <Button variant="secondary" size="sm" onClick={() => setQuoteOpen((prev) => !prev)}>
                Create quote
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <span>Cart</span>
              <Link
                href="/cart"
                className="rounded-md border border-neutral-200 px-2 py-1 font-medium text-neutral-900 hover:bg-neutral-100"
              >
                Go to cart
              </Link>
              {cart?.totalQuantity ? (
                <span className="ml-1 rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">
                  {cart.totalQuantity}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="sr-only" htmlFor="quick-cart-search">
              Search by SKU, part number, name
            </label>
            <input
              id="quick-cart-search"
              ref={searchRef}
              value={pendingQuery}
              onChange={(e) => setPendingQuery(e.currentTarget.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search by SKU, part number, name..."
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 shadow-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <p className={`text-xs text-neutral-500 transition-opacity ${hasAdded ? "opacity-0" : "opacity-100"}`}>
              Arrow keys to select, Enter to move to quantity, Enter again to add.
            </p>
          </div>
        </CardContent>
      </Card>

      {quoteOpen ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Create a quote</h2>
                <p className="text-xs text-neutral-600">Uses current cart items.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setQuoteOpen(false)}>
                Close
              </Button>
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
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" onClick={submitQuote} disabled={quoteLoading}>
                {quoteLoading ? "Creating..." : "Save quote"}
              </Button>
              <p className="text-xs text-neutral-600">Ex VAT totals only for now.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between pb-3">
              <div className="text-sm font-semibold text-neutral-800">Results ({results.length})</div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul role="listbox" className="max-h-[420px] overflow-auto divide-y divide-neutral-200">
                {results.map((product, index) => {
                  const isSelected = index === selectedIndex;
                  const shortTitle = (() => {
                    const raw = product.name || "";
                    const period = raw.indexOf(".");
                    if (period !== -1) return raw.slice(0, period).trim();
                    if (raw.length > 80) return raw.slice(0, 80).trim();
                    return raw;
                  })();
                  return (
                    <li
                      key={product.sku}
                      role="option"
                      aria-selected={isSelected}
                      className={`flex cursor-pointer items-center gap-3 px-3 py-3 text-sm transition min-h-[88px] ${
                        isSelected
                          ? "bg-neutral-50 border border-neutral-200 border-l-4 border-l-neutral-900"
                          : "hover:bg-neutral-50"
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(index);
                      }}
                    >
                      <div className="flex flex-shrink-0 items-center h-full">
                        <ProductImage src={null} alt={product.name} size="sm" className="h-full" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-base font-semibold text-neutral-900">{product.sku}</span>
                        <span className="text-sm text-neutral-700 line-clamp-1">{shortTitle}</span>
                      </div>
                      <span className="text-xs font-medium text-neutral-600">{formatPrice(product.price)}</span>
                    </li>
                  );
                })}
                {results.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-neutral-600">No matches found.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <Card>
            <CardContent className="space-y-3">
              <div className="text-sm font-semibold text-neutral-800">Selected item</div>
              {selectedProduct ? (
                <div className="space-y-1">
                  <div className="text-xl font-semibold text-neutral-900">{selectedProduct.sku}</div>
                  <p className="text-sm text-neutral-700">{selectedProduct.name}</p>
                  <p className="text-sm font-medium text-neutral-800">{formatPrice(selectedProduct.price)}</p>
                  {(() => {
                    const availability = getAvailabilityState({
                      merchandiseId: selectedProduct.merchandiseId,
                      requiresQuote: selectedProduct.requires_quote,
                      discontinued: false,
                    });
                    if (availability === "quote_only") {
                      return <p className="text-xs text-red-700">Quote only (offline).</p>;
                    }
                    if (availability !== "available") {
                      return <p className="text-xs text-red-700">Unavailable for quick add.</p>;
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <p className="text-sm text-neutral-600">Choose an item from the list.</p>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-700" htmlFor="quick-cart-qty">
                  Quantity
                </label>
                <input
                  id="quick-cart-qty"
                  ref={qtyRef}
                  type="number"
                  min={1}
                  max={999}
                  step={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.currentTarget.value)}
                  onKeyDown={onQtyKeyDown}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-24 rounded-md border border-neutral-300 px-2 py-2 text-sm text-neutral-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                  disabled={!selectedProduct}
                />
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleAdd}
                  disabled={
                    !selectedProduct ||
                    !canAddToCart(
                      getAvailabilityState({
                        merchandiseId: selectedProduct.merchandiseId,
                        requiresQuote: selectedProduct.requires_quote,
                        discontinued: false,
                      }),
                    )
                  }
                >
                  {(() => {
                    const availability = getAvailabilityState({
                      merchandiseId: selectedProduct?.merchandiseId,
                      requiresQuote: selectedProduct?.requires_quote,
                      discontinued: false,
                    });
                    if (availability === "quote_only") return "Quote only";
                    if (availability === "available") return "Add to cart";
                    return "Unavailable";
                  })()}
                </Button>
                {message ? <p className="text-xs text-neutral-600">{message}</p> : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
