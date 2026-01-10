"use client";

import React, { useTransition } from "react";
import { toast } from "sonner";

import { useCart } from "components/cart/cart-context";

type Props = {
  merchandiseId: string;
  sku: string;
  title: string;
  priceAmount?: string;
  currencyCode: string;
};

export function AddToCartButton({ merchandiseId, sku, title, priceAmount, currencyCode }: Props) {
  const { addCartItem } = useCart();
  const [isPending, startTransition] = useTransition();

  const onAdd = () => {
    if (!merchandiseId) return;
    const variant = {
      id: merchandiseId,
      title: sku,
      availableForSale: true,
      selectedOptions: [],
      price: { amount: priceAmount ?? "0", currencyCode },
    } as any;

    const product = {
      id: sku,
      handle: sku,
      title: title || sku,
      featuredImage: null,
      variants: [],
    } as any;

    startTransition(() => {
      Promise.resolve(addCartItem(variant, product, 1)).catch((err) => {
        toast.error((err as Error)?.message || "Unable to add to cart");
      });
    });
  };

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={isPending || !merchandiseId}
      className="w-full md:w-auto rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:opacity-60"
    >
      {isPending ? "Adding..." : "Add to cart"}
    </button>
  );
}
