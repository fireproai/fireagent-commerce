"use client";

import { Dialog, Transition } from "@headlessui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { useCart } from "components/cart/cart-context";
import { LINE_ITEM_GRID_TEMPLATE, LineItemRow } from "components/quick/LineItemRow";
import { Button } from "components/ui/Button";
import { Card, CardContent, CardHeader } from "components/ui/Card";
import { TabsFrame } from "components/ui/TabsFrame";
import { canAddToCart, getAvailabilityState } from "lib/commercialState";
import { MONEY_FALLBACK_CURRENCY, formatMoney } from "lib/money";
import type { QuickBuilderProduct } from "lib/quick/products";

import { CataloguePicker } from "./CataloguePicker";

type Props = {
  products: QuickBuilderProduct[];
  storeCurrency: string;
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

type AppliedLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
  product?: QuickBuilderProduct;
};

type QuoteLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
};

const QUOTE_DRAFT_STORAGE_KEY = "fa_quote_draft_v1";

function getCartLinesArray(cart: any): any[] {
  if (!cart || !cart.lines) return [];
  if (Array.isArray(cart.lines)) return cart.lines;
  if (Array.isArray((cart.lines as any).nodes)) return (cart.lines as any).nodes;
  if (Array.isArray((cart.lines as any).edges)) {
    return (cart.lines as any).edges.map((e: any) => e?.node).filter(Boolean);
  }
  return [];
}

function normalizeTab(tab?: string | null): "cart" | "catalogue" | "summary" {
  if (tab === "cart" || tab === "summary") return tab;
  return "catalogue";
}

function buildVariantFromLine(line: CartLine, fallbackCurrency: string) {
  return {
    id: line.merchandiseId,
    title: line.sku,
    availableForSale: true,
    selectedOptions: [],
    price: {
      amount: line.unitPrice.toString(),
      currencyCode: line.currency || fallbackCurrency,
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

export function QuickCartClient({ products, storeCurrency }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { cart, addCartItem, updateCartItem } = useCart();
  const baseCurrency = storeCurrency || MONEY_FALLBACK_CURRENCY;
  const lastQtyRef = React.useRef<HTMLInputElement | null>(null);
  const switchButtonClass =
    "min-w-[190px] rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100";
  const primaryButtonClass =
    "min-w-[130px] rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800";
  const lineGridBase = `grid ${LINE_ITEM_GRID_TEMPLATE} items-start gap-x-3 gap-y-2`;
  const lineHeaderClass = `${lineGridBase} border-b border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800`;
  const totalsRowClass = `${lineGridBase} border-t border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700`;

  const [activeTab, setActiveTab] = React.useState<"cart" | "catalogue" | "summary">(() =>
    normalizeTab(searchParams?.get("tab"))
  );
  const [showQuoteTransferModal, setShowQuoteTransferModal] = React.useState(false);
  const [pendingQuoteLines, setPendingQuoteLines] = React.useState<QuoteLine[] | null>(null);


  const cartLines: CartLine[] = React.useMemo(() => {
    const lines = getCartLinesArray(cart);
    return lines.map((line: any) => {
      const qty = Number(line?.quantity ?? 0);
      const totalAmount = Number((line?.cost?.totalAmount?.amount as string) ?? 0);
      const currency = line?.cost?.totalAmount?.currencyCode || baseCurrency;
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
  }, [cart, baseCurrency]);

  const cartTotals = React.useMemo(() => {
    const totalQty = cartLines.reduce((sum, line) => sum + line.qty, 0);
    const currency = cartLines[0]?.currency || baseCurrency;
    const totalValue = cartLines.reduce((sum, line) => sum + (line.lineTotal || 0), 0);
    return { totalQty, totalValue, currency };
  }, [cartLines, baseCurrency]);
  const currencyCode = cartTotals.currency || baseCurrency;
  const buildQuoteLinesFromCart = React.useCallback(
    () =>
      cartLines
        .filter((line) => line.qty > 0)
        .map((line) => ({
          sku: line.sku,
          name: line.name,
          qty: line.qty,
          unit_price_ex_vat: Number(line.unitPrice || 0),
        })),
    [cartLines]
  );

  const readQuoteDraftLines = () => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed?.quoteLines) ? (parsed.quoteLines as QuoteLine[]) : [];
    } catch {
      return [];
    }
  };

  const writeQuoteDraftLines = (lines: QuoteLine[]) => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      window.localStorage.setItem(
        QUOTE_DRAFT_STORAGE_KEY,
        JSON.stringify({
          ...parsed,
          quoteLines: lines,
        })
      );
    } catch {
      // ignore persistence errors
    }
  };

  const mergeQuoteLines = (existing: QuoteLine[], incoming: QuoteLine[]) => {
    const merged = new Map<string, QuoteLine>();
    existing.forEach((line) => {
      merged.set(line.sku, { ...line });
    });
    incoming.forEach((line) => {
      const current = merged.get(line.sku);
      if (current) {
        merged.set(line.sku, { ...current, qty: current.qty + line.qty });
      } else {
        merged.set(line.sku, { ...line });
      }
    });
    return Array.from(merged.values());
  };

  const applyQuoteTransfer = (mode: "replace" | "merge", lines: QuoteLine[]) => {
    const existing = readQuoteDraftLines();
    const nextLines = mode === "merge" ? mergeQuoteLines(existing, lines) : lines;
    writeQuoteDraftLines(nextLines);
    setShowQuoteTransferModal(false);
    setPendingQuoteLines(null);
    router.push("/quick-quote?tab=quote");
  };

  React.useEffect(() => {
    const paramTab = searchParams?.get("tab");
    if (paramTab) {
      const normalized = normalizeTab(paramTab);
      if (normalized !== activeTab) setActiveTab(normalized);
    }
  }, [searchParams, activeTab]);

  const updateTab = (tab: "cart" | "catalogue" | "summary") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const fromQuoteTransfer = window.sessionStorage.getItem("fa_quote_transfer_focus");
    if (!fromQuoteTransfer) return;
    window.sessionStorage.removeItem("fa_quote_transfer_focus");
    if (activeTab !== "cart") setActiveTab("cart");
    const focusLast = () => {
      if (lastQtyRef.current) {
        lastQtyRef.current.focus();
        lastQtyRef.current.select?.();
      }
    };
    // Focus after current paint to ensure inputs are rendered
    const handle = window.requestAnimationFrame(focusLast);
    return () => window.cancelAnimationFrame(handle);
  }, [activeTab, cartLines]);

  const applyCatalogueLines = async (lines: AppliedLine[]) => {
    if (!lines.length) return;
    for (const line of lines) {
      const product = line.product ?? products.find((item) => item.sku === line.sku);
      const availability = getAvailabilityState({
        merchandiseId: product?.merchandiseId || line.sku,
        requiresQuote: product?.requires_quote,
        discontinued: false,
      });
      if (!canAddToCart(availability)) {
        toast.error(`Cannot add ${line.sku} right now`);
        continue;
      }
      const variant = {
        id: product?.merchandiseId ?? line.sku,
        title: line.sku,
        availableForSale: true,
        selectedOptions: [],
        price: {
          amount: (line.unit_price_ex_vat ?? 0).toString(),
          currencyCode: baseCurrency,
        },
      } as any;
      const minimalProduct = {
        id: product?.handle ?? line.sku,
        handle: product?.handle ?? line.sku,
        title: product?.name || line.name || line.sku,
        featuredImage: null,
        variants: [],
      } as any;
      await Promise.resolve(addCartItem(variant, minimalProduct, line.qty));
    }
  };

  const handleSaveAsQuote = () => {
    const transferLines = buildQuoteLinesFromCart();
    if (!transferLines.length) {
      toast.error("Add items to your cart first.");
      return;
    }
    const existingLines = readQuoteDraftLines();
    if (existingLines.length > 0) {
      setPendingQuoteLines(transferLines);
      setShowQuoteTransferModal(true);
      return;
    }
    applyQuoteTransfer("replace", transferLines);
  };

  const setCartQuantity = (line: CartLine, nextQty: number) => {
    if (!line.merchandiseId) {
      toast.error("Unable to update this line");
      return;
    }
    const safeQty = Math.max(0, Math.min(9999, Math.floor(nextQty)));
    if (safeQty === line.qty) return;
    if (safeQty === 0) {
      updateCartItem(line.merchandiseId, "delete");
      return;
    }
    if (safeQty > line.qty) {
      const diff = safeQty - line.qty;
      const variant = buildVariantFromLine(line, baseCurrency);
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

  const renderCartLines = () => {
    if (!cartLines.length) {
      return <p className="text-sm text-neutral-600">Your cart is empty. Use the catalogue tab to begin.</p>;
    }
    return (
      <div className="space-y-0">
        <div className={lineHeaderClass}>
          <span className="min-w-0 truncate text-left text-sm font-semibold text-neutral-800">Part number</span>
          <span className="min-w-0 truncate text-left text-sm font-semibold text-neutral-800">Description</span>
          <span className="text-right text-sm font-semibold text-neutral-800">Qty</span>
          <span className="text-right text-sm font-semibold text-neutral-800 leading-tight">
            Each
            <span className="block text-xs font-normal text-neutral-600">ex VAT ({currencyCode})</span>
          </span>
          <span className="text-right text-sm font-semibold text-neutral-800 leading-tight">
            Total
            <span className="block text-xs font-normal text-neutral-600">ex VAT ({currencyCode})</span>
          </span>
          <span className="justify-self-end text-right text-sm font-semibold text-neutral-800">Remove</span>
        </div>
        <div className="divide-y divide-neutral-200">
          {cartLines.map((line, idx) => (
            <LineItemRow
              key={`${line.merchandiseId}-${line.sku}`}
              sku={line.sku}
              name={line.name}
              qty={line.qty}
              unitDisplay={formatMoney(line.unitPrice, line.currency || baseCurrency)}
              totalDisplay={formatMoney(line.lineTotal, line.currency || baseCurrency)}
              qtyInputRef={idx === cartLines.length - 1 ? lastQtyRef : undefined}
              onQtyChange={(next) => setCartQuantity(line, next)}
              onIncrement={() => setCartQuantity(line, line.qty + 1)}
              onDecrement={() => setCartQuantity(line, line.qty - 1)}
              onRemove={() => removeCartLine(line)}
            />
          ))}
        </div>
        <div className={totalsRowClass}>
          <span className="text-left text-sm font-semibold text-neutral-900">Totals</span>
          <span />
          <span className="text-right text-sm font-semibold text-neutral-900 tabular-nums">{cartTotals.totalQty}</span>
          <span />
          <span className="text-right text-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
            {formatMoney(cartTotals.totalValue, cartTotals.currency)}
          </span>
          <span className="justify-self-end" />
        </div>
      </div>
    );
  };

  return (
    <section className="relative left-1/2 right-1/2 w-screen max-w-[1720px] -translate-x-1/2 space-y-2 px-4 pt-0 pb-2 sm:px-6 lg:px-8">
      <TabsFrame
        variant="wide"
        activeTab={activeTab}
        onTabChange={(tabId) => updateTab(tabId as "cart" | "catalogue" | "summary")}
        tabs={[
          {
            id: "catalogue",
            label: "Catalogue",
            content: (
              <div className="space-y-3">
                <CataloguePicker
                  open={activeTab === "catalogue"}
                  mode="cart"
                  storageScope="qc"
                  products={products}
                  onApplyLines={applyCatalogueLines}
                  currency={currencyCode}
                />
              </div>
            ),
          },
          {
            id: "cart",
            label: "Cart",
            content: (
              <div className="grid gap-4">
                <Card>
                  <CardHeader className="flex items-center justify-end pb-2">
                    <Button variant="secondary" size="sm" onClick={() => updateTab("catalogue")}>
                      Add from catalogue
                    </Button>
                  </CardHeader>
                  <CardContent>{renderCartLines()}</CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: "summary",
            label: (
              <span className="inline-flex items-center gap-2">
                Save as Quote
                {cartTotals.totalQty > 0 ? (
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">
                    {cartTotals.totalQty}
                  </span>
                ) : null}
              </span>
            ),
            content: (
              <div className="grid gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-neutral-900">Save as Quote</h3>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-neutral-700">
                      <span>Items</span>
                      <span className="font-semibold text-neutral-900">{cartTotals.totalQty}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-neutral-700">
                      <span>Total (ex VAT)</span>
                      <span className="font-semibold text-neutral-900">
                        {formatMoney(cartTotals.totalValue, cartTotals.currency)}
                      </span>
                    </div>
                    <div className="space-y-1 pt-2">
                      {cartLines.length === 0 ? (
                        <p className="text-sm text-neutral-600">No items in the cart yet.</p>
                      ) : (
                        <>
                          {cartLines.slice(0, 3).map((line) => (
                            <div key={line.id ?? line.sku} className="flex items-center justify-between text-sm">
                              <span className="truncate text-neutral-800">{line.sku} — {line.name}</span>
                              <span className="font-semibold text-neutral-900 tabular-nums">{line.qty}</span>
                            </div>
                          ))}
                          {cartLines.length > 3 ? (
                            <p className="text-xs text-neutral-600">+{cartLines.length - 3} more items</p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                      <Button variant="primary" size="sm" onClick={handleSaveAsQuote}>
                        Save as Quote
                      </Button>
                      <Link href="/cart" className="inline-flex items-center justify-center rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100">
                        Go to Cart
                      </Link>
                    </div>
                    <p className="text-xs text-neutral-600">
                      Adds stay in your cart. Use Quick Quote to create tokenised PDFs.
                    </p>
                  </CardContent>
                </Card>
              </div>
            ),
          },
        ]}
      />

      <Transition show={showQuoteTransferModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowQuoteTransferModal(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/20" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 translate-y-2"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2"
            >
              <Dialog.Panel className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
                <Dialog.Title className="text-base font-semibold text-neutral-900">Save as quote</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-neutral-700">
                  Your quote already has items. Do you want to replace the quote or merge quantities?
                </Dialog.Description>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (pendingQuoteLines) applyQuoteTransfer("merge", pendingQuoteLines);
                    }}
                  >
                    Merge
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (pendingQuoteLines) applyQuoteTransfer("replace", pendingQuoteLines);
                    }}
                  >
                    Replace
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowQuoteTransferModal(false)}>
                    Cancel
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </section>
  );
}
