'use client';

import { useState, useTransition } from 'react';
import { useProduct } from 'components/product/product-context';
import { Product, ProductVariant } from 'lib/shopify/types';
import { useCart } from './cart-context';

/** Small button component */
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

/** Named export required by product-description.tsx */
export function AddToCart() {
  // Safe because ProductProvider wraps this component
  const product = useProduct() as Product;

  // ✔ Correct function name from cart-context
  const { addCartItem } = useCart();

  // Select first variant by default
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants?.[0] || null
  );

  const [pending, startTransition] = useTransition();

  async function handleAddToCart() {
    if (!selectedVariant) return;

    // ✔ Correct function signature:
    // addCartItem(variant: ProductVariant, product: Product)
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
      {/* Variant Selector */}
      {product.variants && product.variants.length > 1 && (
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

/** Default export so imports still work */
export default AddToCart;
