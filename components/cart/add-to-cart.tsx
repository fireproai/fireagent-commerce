'use client';

import { useState, useTransition } from 'react';
import { Product, ProductVariant } from 'lib/shopify/types';
import { useCart } from './cart-context';

/** Submit button */
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

/** Named export so product-description.tsx can import it */
export function AddToCart({ product }: { product: Product }) {
  const { addCartItem } = useCart();

  // Default variant = first variant
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants?.[0] || null
  );

  const [pending, startTransition] = useTransition();

  async function handleAddToCart() {
    if (!selectedVariant) return;
    await addCartItem(selectedVariant, product);
  }

  return (
    <form
      action={(e) => {
        e.preventDefault();
        startTransition(handleAddToCart);
      }}
      className="grid gap-4"
    >
      {/* Variant selector */}
      {product.variants.length > 1 && (
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
      )}

      <SubmitButton pending={pending} />
    </form>
  );
}

/** Default export for compatibility */
export default AddToCart;
