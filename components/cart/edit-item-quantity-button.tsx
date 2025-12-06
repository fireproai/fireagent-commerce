'use client';

import { updateItemQuantity } from 'components/cart/actions';
import type { CartItem } from 'lib/shopify/types';
import { useTransition, useState } from 'react';

export function EditItemQuantityButton({
  item,
  type,
  optimisticUpdate
}: {
  item: CartItem;
  type: 'plus' | 'minus';
  optimisticUpdate?: (id: string, updateType: 'plus' | 'minus') => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update() {
    setError(null);

    const newQuantity =
      type === 'plus' ? item.quantity + 1 : item.quantity - 1;

    // 🔥 optional optimistic UI update
    optimisticUpdate?.(item.merchandise.id, type);

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
    <button
      disabled={pending}
      onClick={update}
      className="px-2 py-1 border rounded disabled:opacity-50"
    >
      {type === 'plus' ? '+' : '-'}
      {error && <span className="text-red-600 text-sm ml-2">{error}</span>}
    </button>
  );
}
