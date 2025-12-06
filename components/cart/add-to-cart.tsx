'use client';

import { useState, useTransition } from 'react';
import { useProduct } from 'components/product/product-context';
import { Product, ProductVariant } from 'lib/shopify/types';
import { useCart } from './cart-context';

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      className="w-full rounded bg-black py-3 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      disabled={pending}
    >
      {pending ? 'Adding…' : 'Add to Cart'}
    </button>
  );
}

export default function AddToCart() {
  const product = useProduct() as Product;
  const { addItem } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants[0]
  );

  const [pending, startTransition] = useTransition();

  async function handleAddToCart() {
    if (!selectedVariant) return;
    await addItem(selectedVariant.id);
  }

  return (
    <form
      action={(e) => {
        e.preventDefault();
        startTransition(handleAddToCart);
      }}
      className="grid gap-4"
    >
      <div>
        <select
          className="border w-full p-2"
          value={selectedVariant?.id}
          onChange={(e) => {
            const variant = product.variants.find(
              (v) => v.id === e.target.value
            );
            setSelectedVariant(variant || null);
          }}
        >
          {product.variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.title}
            </option>
          ))}
        </select>
      </div>

      <SubmitButton pending={pending} />
    </form>
  );
}
