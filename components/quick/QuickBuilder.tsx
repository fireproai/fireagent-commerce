"use client";

import Link from "next/link";
import React from "react";
import { toast } from "sonner";

import { Button } from "components/ui/Button";
import { Card, CardContent, CardHeader } from "components/ui/Card";
import { ProductImage } from "components/ui/ProductImage";
import { canAddToCart, getAvailabilityState } from "lib/commercialState";
import { MONEY_FALLBACK_CURRENCY, coerceAmount, formatMoney } from "lib/money";
import type { QuickBuilderProduct } from "lib/quick/products";

type Mode = "cart" | "quote";

type QuickBuilderProps = {
  products: QuickBuilderProduct[];
  mode: Mode;
  title: string;
  description?: React.ReactNode;
  trailingHeader?: React.ReactNode;
  secondaryAction?: { href: string; label: string };
  onAddLine: (payload: { product: QuickBuilderProduct; quantity: number }) => Promise<void> | void;
  canAdd?: boolean;
  disabledReason?: string;
  currency?: string;
};

function formatPrice(price: number | null | undefined, currency: string) {
  if (price === null || price === undefined) return "Login to see price";
  const value = coerceAmount(price);
  if (!Number.isFinite(value as number) || value === null) return "Login to see price";
  return formatMoney(value, currency);
}

export function QuickBuilder({
  products,
  mode,
  title,
  description,
  trailingHeader,
  secondaryAction,
  onAddLine,
  canAdd = true,
  disabledReason,
  currency = MONEY_FALLBACK_CURRENCY,
}: QuickBuilderProps) {
  const [pendingQuery, setPendingQuery] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [quantity, setQuantity] = React.useState("1");
  const [message, setMessage] = React.useState<string | null>(null);
  const [lastAdded, setLastAdded] = React.useState<{ sku: string; qty: number } | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const qtyRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    searchRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => setQuery(pendingQuery), 150);
    return () => clearTimeout(t);
  }, [pendingQuery]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = products.map((product) => {
      const name = product.name.toLowerCase();
      const sku = product.sku.toLowerCase();
      let score = 0;
      if (q) {
        if (sku === q) score = 300;
        else if (sku.startsWith(q)) score = 200;
        else if (sku.includes(q)) score = 150;
        else if (name.startsWith(q)) score = 120;
        else if (name.includes(q)) score = 100;
      }
      return { ...product, _score: score };
    });
    const sorted = scored
      .sort((a, b) => b._score - a._score || a.sku.localeCompare(b.sku))
      .filter((p) => (q ? p._score > 0 : true));
    return q ? sorted.slice(0, 20) : sorted.slice(0, 15);
  }, [products, query]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, query]);

  const selectedProduct = results[selectedIndex] ?? results[0] ?? null;

  const availability =
    selectedProduct &&
    getAvailabilityState({
      merchandiseId: selectedProduct.merchandiseId,
      requiresQuote: selectedProduct.requires_quote,
      discontinued: false,
    });

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

  const normalizedQty = Math.max(1, Math.min(999, parseInt(quantity || "1", 10) || 1));
  const unavailableForQuickAdd = availability && availability !== "available";
  const availabilityLabel =
    mode === "quote" && unavailableForQuickAdd ? "Add to quote (manual pricing)" : mode === "quote" ? "Add to quote" : "Add to cart";

  const handleAdd = async () => {
    if (!selectedProduct) return;

    const availabilityState = availability ?? "unavailable";
    const canProceedInMode =
      availabilityState === "available" || (mode === "quote" && availabilityState !== "discontinued");
    if (!canProceedInMode) {
      setMessage(`SKU ${selectedProduct.sku} is unavailable for this action`);
      searchRef.current?.focus();
      searchRef.current?.select();
      return;
    }

    try {
      const addedSku = selectedProduct.sku;
      const addedQty = normalizedQty;
      await onAddLine({ product: selectedProduct, quantity: addedQty });
      const successMessage =
        mode === "cart"
          ? `Added ${addedQty} x ${addedSku}`
          : `Added ${addedQty} x ${addedSku} to quote`;
      setLastAdded({ sku: addedSku, qty: addedQty });
      setMessage(successMessage);
      toast.success(successMessage);
      setQuantity("1");
      setPendingQuery("");
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        searchRef.current?.focus();
        searchRef.current?.select();
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Could not process action, please try again.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <section className="flex w-full flex-col gap-4">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
              {secondaryAction ? (
                <Link
                  href={secondaryAction.href}
                  className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-900 hover:bg-neutral-100"
                >
                  {secondaryAction.label}
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-600">{trailingHeader}</div>
          </div>

          {description ? <div className="text-sm text-neutral-700">{description}</div> : null}

          <div className="flex flex-col gap-2">
            <label className="sr-only" htmlFor="quick-builder-search">
              Search by SKU, part number, name
            </label>
            <input
              id="quick-builder-search"
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
            <p className="text-xs text-neutral-500">
              Arrow keys to select, Enter to move to quantity, Enter again to add.
            </p>
          </div>
        </CardContent>
      </Card>

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
                      <span className="text-xs font-medium text-neutral-600">{formatPrice(product.price, currency)}</span>
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
              <div className="text-sm font-semibold text-neutral-800">
                {mode === "quote" ? "Selected item for quote" : "Selected item"}
              </div>
              {selectedProduct ? (
                <div className="space-y-1">
                  <div className="text-xl font-semibold text-neutral-900">{selectedProduct.sku}</div>
                  <p className="text-sm text-neutral-700">{selectedProduct.name}</p>
                  <p className="text-sm font-medium text-neutral-800">{formatPrice(selectedProduct.price, currency)}</p>
                  {(() => {
                    if (!availability) return null;
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
                <label className="text-xs font-medium text-neutral-700" htmlFor="quick-builder-qty">
                  Quantity
                </label>
                <input
                  id="quick-builder-qty"
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
                    !canAdd ||
                    (availability ? !canAddToCart(availability) && mode === "cart" : false) ||
                    (availability === "discontinued")
                  }
                >
                  {availabilityLabel}
                </Button>
                {mode === "quote" && unavailableForQuickAdd ? (
                  <p className="text-xs text-neutral-600">
                    This item cannot be added to cart instantly; it will be saved for manual pricing.
                  </p>
                ) : null}
                {message && lastAdded ? (
                  <p className="text-xs text-neutral-600">
                    {mode === "cart"
                      ? `Added ${lastAdded.qty} x ${lastAdded.sku}`
                      : `Added ${lastAdded.qty} x ${lastAdded.sku} to quote`}
                  </p>
                ) : message ? (
                  <p className="text-xs text-neutral-600">{message}</p>
                ) : null}
                {!canAdd && disabledReason ? (
                  <p className="text-xs text-red-700">{disabledReason}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
