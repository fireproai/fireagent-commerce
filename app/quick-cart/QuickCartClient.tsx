"use client";

import Link from "next/link";
import React from "react";

import { useCart } from "components/cart/cart-context";
import { QuickBuilder } from "components/quick/QuickBuilder";
import type { QuickBuilderProduct } from "lib/quick/products";

type Props = {
  products: QuickBuilderProduct[];
};

export function QuickCartClient({ products }: Props) {
  const { cart, addCartItem } = useCart();
  const cartCount = cart?.totalQuantity || 0;

  const trailingHeader = (
    <>
      <span>Cart</span>
      <Link
        href="/cart"
        className="rounded-md border border-neutral-200 px-2 py-1 font-medium text-neutral-900 hover:bg-neutral-100"
      >
        Go to cart
      </Link>
      {cartCount ? (
        <span className="ml-1 rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">
          {cartCount}
        </span>
      ) : null}
    </>
  );

  return (
    <QuickBuilder
      products={products}
      mode="cart"
      title="Quick Cart"
      description="Search SKUs and add items quickly."
      trailingHeader={trailingHeader}
      secondaryAction={{ href: "/quick-quote", label: "Continue in Quick Quote" }}
      onAddLine={({ product, quantity }) => {
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

        return addCartItem(variant, minimalProduct, quantity);
      }}
      canAdd
    />
  );
}
