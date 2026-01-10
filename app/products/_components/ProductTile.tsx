"use client";

import Link from "next/link";
import React, { useTransition } from "react";

import { SkuTitle } from "components/product/SkuTitle";
import { useCart } from "components/cart/cart-context";

type Product = {
  sku: string;
  merchandiseId?: string | null;
  product_name?: string;
  description?: string;
  title?: string;
  name?: string;
  nav_group?: string;
  nav_group_1?: string;
  handle?: string;
  productId?: string;
  variantId?: string;
  price?: number | string;
  price_trade_gbp?: number | string;
  net_price?: number | string;
  unit_price?: number | string;
  list_price?: number | string;
  requires_quote?: boolean;
  discontinued?: boolean;
};

type Props = {
  product: Product;
};

function getPriceValue(product: Product): number | string | null {
  const price =
    product.price_trade_gbp ??
    product.price ??
    product.net_price ??
    product.unit_price ??
    product.list_price ??
    null;
  return price ?? null;
}

function formatPrice(price: number | string | null): string {
  if (price === null || price === undefined) return "Login to see price";
  if (typeof price === "number") return `\u00a3${price.toFixed(2)}`;
  const parsed = parseFloat(price);
  return Number.isFinite(parsed) ? `\u00a3${parsed.toFixed(2)}` : price;
}

export function ProductTile({ product }: Props) {
  const [qtyText, setQtyText] = React.useState<string>("1");
  const { addCartItem } = useCart();
  const [isPending, startTransition] = useTransition();

  const label =
    product.product_name ??
    product.description ??
    product.title ??
    product.name ??
    product.nav_group ??
    "";

  const priceRaw = getPriceValue(product);
  const priceDisplay = formatPrice(priceRaw);
  const priceAmount =
    typeof priceRaw === "number"
      ? priceRaw.toString()
      : Number.isFinite(parseFloat(String(priceRaw)))
      ? parseFloat(String(priceRaw)).toString()
      : "0";

  const merchandiseId = product.merchandiseId ?? product.variantId ?? null;
  const requiresQuote = Boolean(product.requires_quote);
  const discontinued = Boolean(product.discontinued);
  const canAdd = Boolean(merchandiseId && !requiresQuote && !discontinued);

  const onAddToCart = () => {
    const parsedQty = parseInt(qtyText || "1", 10);
    const normalizedQty = Number.isFinite(parsedQty) ? parsedQty : 1;
    const quantity = Math.min(999, Math.max(1, normalizedQty));

    if (!canAdd || !merchandiseId) return;

    const variant = {
      id: merchandiseId,
      title: product.sku,
      availableForSale: true,
      selectedOptions: [],
      price: { amount: priceAmount ?? "0", currencyCode: "GBP" },
    } as any;

    const minimalProduct = {
      id: product.productId ?? product.handle ?? product.sku,
      handle: product.handle ?? product.sku,
      title: label || product.sku,
      featuredImage: null,
      variants: [],
    } as any;

    startTransition(() => {
      addCartItem(variant, minimalProduct, quantity);
    });
  };

  const onQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQtyText(e.currentTarget.value);
  };

  const onQtyBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.currentTarget.value || "1", 10);
    const clamped = Number.isFinite(parsed) ? Math.min(999, Math.max(1, parsed)) : 1;
    setQtyText(clamped.toString());
  };

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="group flex h-full flex-col justify-between rounded-lg border border-neutral-200 bg-white p-4 md:py-3.5 shadow-sm transition hover:border-neutral-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900">
      <Link href={`/product/sku/${encodeURIComponent(product.sku)}`} className="block space-y-3">
        <div className="flex h-32 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-500">
          Image coming soon
        </div>
        <div className="space-y-2">
          <SkuTitle sku={product.sku} title={label} size="md" variant="list" className="min-w-0" />
        </div>
      </Link>

      <div className="mb-2 text-right text-lg font-semibold tracking-tight text-neutral-900">
        {priceDisplay}
      </div>

      <div
        className="mt-3 space-y-2"
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
        onPointerDown={stopPropagation}
      >
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={999}
            step={1}
            value={qtyText}
            onChange={onQtyChange}
            onBlur={onQtyBlur}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            className="h-10 w-16 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200 focus:ring-offset-0"
          />
          <button
            type="button"
            onClick={(e) => {
              stopPropagation(e);
              onAddToCart();
            }}
            onMouseDown={stopPropagation}
            onPointerDown={stopPropagation}
            disabled={isPending || !canAdd}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-red-800 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-red-900/10 hover:bg-red-700 hover:shadow-md active:bg-red-800/90 focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:opacity-60"
          >
            {requiresQuote
              ? "Quote only"
              : discontinued
                ? "Unavailable"
                : !merchandiseId
                  ? "Unavailable"
                  : isPending
                    ? "Adding..."
                    : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
