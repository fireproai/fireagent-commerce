'use server';

import { TAGS } from 'lib/constants';
import {
  addToCart,
  createCart,
  getCart,
  removeFromCart,
  updateCart
} from 'lib/shopify';
import { revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Fix for TypeScript: Next.js 16 canary revalidateTag type definitions are wrong.
// Casting to `any` resolves VS Code red errors but runtime works correctly.
const revalidate = (tag: string) => (revalidateTag as any)(tag);

// Add item to cart
export async function addItem(
  _prevState: any,
  selectedVariantId: string | undefined
) {
  if (!selectedVariantId) {
    return 'Error adding item to cart';
  }

  try {
    await addToCart([{ merchandiseId: selectedVariantId, quantity: 1 }]);
    revalidate(TAGS.cart);
  } catch {
    return 'Error adding item to cart';
  }
}

// Remove item from cart
export async function removeItem(_prevState: any, merchandiseId: string) {
  try {
    const cart = await getCart();
    if (!cart) return 'Error fetching cart';

    const lineItem = cart.lines.find(
      (line) => line.merchandise.id === merchandiseId
    );

    if (!lineItem?.id) return 'Item not found in cart';

    await removeFromCart([lineItem.id]);
    revalidate(TAGS.cart);
  } catch {
    return 'Error removing item from cart';
  }
}

// Update item quantity
export async function updateItemQuantity(
  _prevState: any,
  payload: { merchandiseId: string; quantity: number }
) {
  const { merchandiseId, quantity } = payload;

  try {
    const cart = await getCart();
    if (!cart) return 'Error fetching cart';

    const lineItem = cart.lines.find(
      (line) => line.merchandise.id === merchandiseId
    );

    if (lineItem?.id) {
      if (quantity === 0) {
        await removeFromCart([lineItem.id]);
      } else {
        await updateCart([
          { id: lineItem.id, merchandiseId, quantity }
        ]);
      }
    } else if (quantity > 0) {
      await addToCart([{ merchandiseId, quantity }]);
    }

    revalidate(TAGS.cart);
  } catch (e) {
    console.error(e);
    return 'Error updating item quantity';
  }
}

// Redirect user to Shopify checkout
export async function redirectToCheckout() {
  const cart = await getCart();
  if (cart?.checkoutUrl) redirect(cart.checkoutUrl);
}

// Create a fresh cart and persist ID in cookie
export async function createCartAndSetCookie() {
  const cart = await createCart();
  if (cart?.id) (await cookies()).set('cartId', cart.id);
}
