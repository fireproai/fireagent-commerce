"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { useCart } from "components/cart/cart-context";

type QuickCartProduct = {
  sku: string;
  name: string;
  price?: number | null;
  handle?: string | null;
  merchandiseId?: string | null;
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
    const normalizedQty = Math.max(1, Math.min(999, parseInt(quantity || "1", 10) || 1));

    if (!merchandiseId) {
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
      const data = await res.json();
      if (!res.ok) {
        const devMessage =
          process.env.NODE_ENV !== "production" ? data?.error || "Could not create quote" : "Could not create quote";
        setQuoteError(devMessage);
        setQuoteLoading(false);
        return;
      }
      toast.success(`Quote ${data.quote_number} created`);
      router.push(`/quotes/${data.quote_number}?e=${encodeURIComponent(quoteEmail)}`);
    } catch (err) {
      const devMessage =
        process.env.NODE_ENV !== "production"
          ? (err as Error)?.message || "Could not create quote, please try again."
          : "Could not create quote, please try again.";
      setQuoteError(devMessage);
      setQuoteLoading(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-neutral-900">Quick Cart</h1>
              <button
                type="button"
                onClick={() => setQuoteOpen((prev) => !prev)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
              >
                Create quote
              </button>
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
        </div>
      </div>

      {quoteOpen ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Create a quote</h2>
              <p className="text-xs text-neutral-600">Uses current cart items.</p>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900"
              onClick={() => setQuoteOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
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
          {quoteError ? <p className="mt-2 text-xs text-red-700">{quoteError}</p> : null}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={submitQuote}
              disabled={quoteLoading}
              className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
            >
              {quoteLoading ? "Creating..." : "Save quote"}
            </button>
            <p className="text-xs text-neutral-600">Ex VAT totals only for now.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800">
              Results ({results.length})
            </div>
            <ul role="listbox" className="max-h-[420px] overflow-auto divide-y divide-neutral-200">
              {results.map((product, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li
                    key={product.sku}
                    role="option"
                    aria-selected={isSelected}
                    className={`flex cursor-pointer flex-col gap-1 px-3 py-2 text-sm transition ${
                      isSelected ? "bg-neutral-50 ring-1 ring-inset ring-red-700" : "hover:bg-neutral-50"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(index);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-base font-semibold text-neutral-900">{product.sku}</span>
                      <span className="text-xs font-medium text-neutral-600">{formatPrice(product.price)}</span>
                    </div>
                    <p className="text-sm text-neutral-700 line-clamp-2">{product.name}</p>
                  </li>
                );
              })}
              {results.length === 0 ? (
                <li className="px-3 py-3 text-sm text-neutral-600">No matches found.</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-neutral-800">Selected item</div>
            {selectedProduct ? (
              <div className="mt-2 space-y-1">
                <div className="text-xl font-semibold text-neutral-900">{selectedProduct.sku}</div>
                <p className="text-sm text-neutral-700">{selectedProduct.name}</p>
                <p className="text-sm font-medium text-neutral-800">{formatPrice(selectedProduct.price)}</p>
                {!selectedProduct.merchandiseId ? (
                  <p className="text-xs text-red-700">Unavailable for quick add.</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-neutral-600">Choose an item from the list.</p>
            )}

            <div className="mt-3 space-y-2">
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
              <button
                type="button"
                onClick={handleAdd}
                disabled={!selectedProduct?.merchandiseId}
                className="w-full rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-red-900/10 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:opacity-60"
              >
                {selectedProduct?.merchandiseId ? "Add to cart" : "Unavailable"}
              </button>
              {message ? <p className="text-xs text-neutral-600">{message}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
