'use client';

import { updateItemQuantity } from 'components/cart/actions';
import type { CartItem } from 'lib/shopify/types';
import { useTransition, useState } from 'react';

export function EditItemQuantityButton({ item }: { item: CartItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(type: 'plus' | 'minus') {
    setError(null);

    const newQuantity =
      type === 'plus' ? item.quantity + 1 : item.quantity - 1;

    startTransition(() => {
      updateItemQuantity(undefined, {
        merchandiseId: item.merchandise.id,
        quantity: newQuantity
      }).catch(() => {
        setError('Failed to update quantity');
      });
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() => update('minus')}
        className="px-2 py-1 border rounded disabled:opacity-50"
      >
        -
      </button>

      <span>{item.quantity}</span>

      <button
        disabled={pending}
        onClick={() => update('plus')}
        className="px-2 py-1 border rounded disabled:opacity-50"
      >
        +
      </button>

      {error && <span className="text-red-600 text-sm ml-2">{error}</span>}
    </div>
  );
}
