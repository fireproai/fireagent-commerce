"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import { useCart } from "components/cart/cart-context";
import { Button } from "components/ui/Button";
import { Card, CardContent, CardHeader } from "components/ui/Card";
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

function normalizeTab(tab?: string | null): "cart" | "catalogue" {
  if (tab === "catalogue") return "catalogue";
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

  const [activeTab, setActiveTab] = React.useState<"cart" | "catalogue">(() => {
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

  const updateTab = (tab: "cart" | "catalogue") => {
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
    if (!canAddToCart(availability)) {
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

  const renderCartLines = () => {
    if (!cartLines.length) {
      return <p className="text-sm text-neutral-600">Your cart is empty. Use the catalogue tab to begin.</p>;
    }
    return (
      <div className="divide-y divide-neutral-200">
        {cartLines.map((line) => (
          <div key={`${line.merchandiseId}-${line.sku}`} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{line.sku}</p>
              <p className="text-sm text-neutral-700">{line.name}</p>
              <p className="text-xs text-neutral-600">
                {formatCurrency(line.unitPrice, line.currency)} each - Qty {line.qty} -{" "}
                {formatCurrency(line.lineTotal, line.currency)} total
              </p>
            </div>
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
                  -
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
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-600">Quick cart</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Simpro-style builder</h1>
          <p className="text-sm text-neutral-600">Add items fast, keep the basket in sync, and jump to checkout or quotes.</p>
        </div>
        <Link
          href="/quick-quote"
          className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
        >
          Go to Quick Quote
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        {[
          { id: "cart", label: "Cart" },
          { id: "catalogue", label: "Catalogue" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => updateTab(tab.id as "cart" | "catalogue")}
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
              <Button variant="secondary" size="sm" onClick={() => updateTab("catalogue")}>
                Add from catalogue
              </Button>
            </CardHeader>
            <CardContent>{renderCartLines()}</CardContent>
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
              <p className="text-xs text-neutral-600">Adds stay in your cart. Use Quick Quote to create tokenised PDFs.</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "catalogue" ? (
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">Browse the catalogue inline. Adds go straight into the cart.</p>
          <CataloguePicker open mode="cart" products={products} onAdd={handleAddProduct} />
        </div>
      ) : null}
    </section>
  );
}
