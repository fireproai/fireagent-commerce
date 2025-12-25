'use client';

import { useState, useTransition } from 'react';
import { Product, ProductVariant } from 'lib/shopify/types';
import { useCart } from './cart-context';

/** Submit button */
function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      className="w-full rounded bg-white py-3 text-neutral-900 disabled:opacity-50"
      disabled={pending}
    >
      {pending ? 'Adding…' : 'Add to Cart'}
    </button>
  );
}

/** AddToCart receives product as a prop */
export function AddToCart({ product }: { product: Product }) {
  const { addCartItem } = useCart();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants?.[0] || null
  );
  const [quantity, setQuantity] = useState<number>(1);

  const [pending, startTransition] = useTransition();

  async function handleAddToCart() {
    if (!selectedVariant || quantity < 1) return;
    await addCartItem(selectedVariant, product, quantity);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();

        // ✔ React 18 safe: startTransition MUST NOT return a Promise
        startTransition(() => {
          void handleAddToCart(); // fire-and-forget
        });
      }}
      className="grid gap-4"
    >
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          aria-label="Decrease quantity"
        >
          -
        </button>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="w-16 rounded border border-neutral-300 px-2 py-2 text-center text-sm"
          aria-label="Quantity"
        />
        <button
          type="button"
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
          onClick={() => setQuantity((q) => q + 1)}
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <SubmitButton pending={pending} />
    </form>
  );
}

export default AddToCart;

