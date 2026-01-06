"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { useCart } from "components/cart/cart-context";
import { LINE_ITEM_GRID_TEMPLATE, LineItemRow } from "components/quick/LineItemRow";
import { Button } from "components/ui/Button";
import { Card, CardContent, CardHeader } from "components/ui/Card";
import { TabsFrame } from "components/ui/TabsFrame";
import { canAddToCart, getAvailabilityState } from "lib/commercialState";
import type { QuickBuilderProduct } from "lib/quick/products";

import { CataloguePicker } from "./CataloguePicker";

type Props = {
  products: QuickBuilderProduct[];
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
type AppliedLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
  product?: QuickBuilderProduct;
};

function formatCurrency(value: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    minimumFractionDigits: 2,
  });
  return formatter.format(Number.isFinite(value) ? value : 0);
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

function normalizeTab(tab?: string | null): "cart" | "catalogue" | "summary" {
  if (tab === "catalogue" || tab === "summary") return tab;
  return "cart";
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

export function QuickCartClient({ products }: Props) {
  const searchParams = useSearchParams();
  const { cart, addCartItem, updateCartItem } = useCart();
  const switchButtonClass =
    "min-w-[190px] rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100";
  const primaryButtonClass =
    "min-w-[130px] rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800";
  const lineGridBase = `grid ${LINE_ITEM_GRID_TEMPLATE} items-start gap-3`;
  const lineHeaderClass = `${lineGridBase} border-b border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800`;
  const totalsRowClass = `${lineGridBase} border-t border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700`;

  const [activeTab, setActiveTab] = React.useState<"cart" | "catalogue" | "summary">(() => {
    const paramTab = searchParams?.get("tab");
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (stored) return normalizeTab(stored);
    }
    return normalizeTab(paramTab);
  });

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
          currencyCode: "GBP",
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
    updateTab("cart");
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

  const renderCartLines = () => {
    if (!cartLines.length) {
      return <p className="text-sm text-neutral-600">Your cart is empty. Use the catalogue tab to begin.</p>;
    }
    return (
      <div className="space-y-0">
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
          {cartLines.map((line) => (
            <LineItemRow
              key={`${line.merchandiseId}-${line.sku}`}
              sku={line.sku}
              name={line.name}
              qty={line.qty}
              unitDisplay={formatCurrency(line.unitPrice, line.currency)}
              totalDisplay={formatCurrency(line.lineTotal, line.currency)}
              onQtyChange={(next) => setCartQuantity(line, next)}
              onIncrement={() => setCartQuantity(line, line.qty + 1)}
              onDecrement={() => setCartQuantity(line, line.qty - 1)}
              onRemove={() => removeCartLine(line)}
            />
          ))}
        </div>
        <div className={totalsRowClass}>
          <span className="text-left text-sm font-semibold text-neutral-900">Totals</span>
          <span className="text-right text-sm font-semibold text-neutral-900 tabular-nums">{cartTotals.totalQty}</span>
          <span />
          <span className="text-right text-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
            {formatCurrency(cartTotals.totalValue, cartTotals.currency)}
          </span>
          <span className="justify-self-end" />
        </div>
      </div>
    );
  };

  return (
    <section className="w-full space-y-2 pt-0 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Quick Cart</h1>
          <p className="text-sm text-neutral-600">Fast SKU entry for professional trade orders.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 min-w-[320px] justify-end">
          <Link href="/cart" className={primaryButtonClass}>
            Go to Cart
          </Link>
          <Link href="/quick-quote" className={switchButtonClass}>
            {cartLines.length ? "Continue in Quick Quote" : "Switch to Quick Quote"}
          </Link>
        </div>
      </div>

      <TabsFrame
        activeTab={activeTab}
        onTabChange={(tabId) => updateTab(tabId as "cart" | "catalogue" | "summary")}
        tabs={[
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
            id: "catalogue",
            label: "Catalogue",
            content: (
              <div className="space-y-3">
                <p className="text-sm text-neutral-700">Browse the catalogue inline. Adds go straight into the cart.</p>
                <CataloguePicker open mode="cart" products={products} onApplyLines={applyCatalogueLines} />
              </div>
            ),
          },
          {
            id: "summary",
            label: (
              <span className="inline-flex items-center gap-2">
                Summary
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
                    <div className="space-y-2 pt-2">
                      <Link
                        href="/cart"
                        className="inline-flex w-full items-center justify-center rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                      >
                        Checkout
                      </Link>
                      <Link
                        href="/quick-quote"
                        className="inline-flex w-full items-center justify-center rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
                      >
                        Create quote
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
    </section>
  );
}
