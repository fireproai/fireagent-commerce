'use client';

import type { Cart, CartItem, Product, ProductVariant } from 'lib/shopify/types';
import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { toast } from 'sonner';

type UpdateType = 'plus' | 'minus' | 'delete';

type CartAction =
  | {
      type: 'UPDATE_ITEM';
      payload: { merchandiseId: string; updateType: UpdateType };
    }
  | {
      type: 'ADD_ITEM';
      payload: { variant: ProductVariant; product: Product; quantity: number };
    }
  | {
      type: 'HYDRATE';
      payload: Cart;
    };

type CartContextType = {
  cart: Cart;
  updateCartItem: (merchandiseId: string, updateType: UpdateType) => void;
  addCartItem: (variant: ProductVariant, product: Product, quantity?: number) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);
const LOCAL_STORAGE_KEY = 'fireagent_cart_v1';

function calculateItemCost(quantity: number, price: string): string {
  return (Number(price) * quantity).toString();
}

function updateCartItem(item: CartItem, updateType: UpdateType): CartItem | null {
  if (updateType === 'delete') return null;

  const newQuantity = updateType === 'plus' ? item.quantity + 1 : item.quantity - 1;
  if (newQuantity === 0) return null;

  const singleItemAmount = Number(item.cost.totalAmount.amount) / item.quantity;
  const newTotalAmount = calculateItemCost(newQuantity, singleItemAmount.toString());

  return {
    ...item,
    quantity: newQuantity,
    cost: {
      ...item.cost,
      totalAmount: {
        ...item.cost.totalAmount,
        amount: newTotalAmount
      }
    }
  };
}

function createOrUpdateCartItem(
  existingItem: CartItem | undefined,
  variant: ProductVariant,
  product: Product,
  quantityToAdd: number
): CartItem {
  const quantity = existingItem ? existingItem.quantity + quantityToAdd : quantityToAdd;
  const priceAmount =
    variant.price?.amount ||
    (variant as any)?.priceV2?.amount ||
    (variant as any)?.priceAmount ||
    '0';
  const priceCurrency =
    variant.price?.currencyCode ||
    (variant as any)?.priceV2?.currencyCode ||
    (variant as any)?.currencyCode ||
    'USD';

  const totalAmount = calculateItemCost(quantity, priceAmount);

  return {
    id: existingItem?.id,
    quantity,
    cost: {
      totalAmount: {
        amount: totalAmount,
        currencyCode: priceCurrency
      }
    },
    merchandise: {
      id: variant.id,
      title: variant.title,
      selectedOptions: variant.selectedOptions,
      product: {
        id: product.id,
        handle: product.handle,
        title: product.title,
        featuredImage: product.featuredImage
      }
    }
  };
}

function updateCartTotals(lines: CartItem[]): Pick<Cart, 'totalQuantity' | 'cost'> {
  const totalQuantity = lines.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = lines.reduce((sum, item) => sum + Number(item.cost.totalAmount.amount), 0);
  const currencyCode = lines[0]?.cost.totalAmount.currencyCode ?? 'USD';

  return {
    totalQuantity,
    cost: {
      subtotalAmount: { amount: totalAmount.toString(), currencyCode },
      totalAmount: { amount: totalAmount.toString(), currencyCode },
      totalTaxAmount: { amount: '0', currencyCode }
    }
  };
}

function createEmptyCart(): Cart {
  return {
    id: undefined,
    checkoutUrl: '',
    totalQuantity: 0,
    lines: [],
    cost: {
      subtotalAmount: { amount: '0', currencyCode: 'USD' },
      totalAmount: { amount: '0', currencyCode: 'USD' },
      totalTaxAmount: { amount: '0', currencyCode: 'USD' }
    }
  };
}

function cartReducer(state: Cart | undefined, action: CartAction): Cart {
  const currentCart = state || createEmptyCart();

  switch (action.type) {
    case 'HYDRATE': {
      return action.payload || currentCart;
    }
    case 'UPDATE_ITEM': {
      const { merchandiseId, updateType } = action.payload;
      console.log('[cartReducer] UPDATE_ITEM', merchandiseId, updateType);
      const updatedLines = currentCart.lines
        .map((item) =>
          item.merchandise.id === merchandiseId ? updateCartItem(item, updateType) : item
        )
        .filter(Boolean) as CartItem[];

      if (updatedLines.length === 0) {
        return {
          ...currentCart,
          lines: [],
          totalQuantity: 0,
          cost: {
            ...currentCart.cost,
            totalAmount: { ...currentCart.cost.totalAmount, amount: '0' }
          }
        };
      }

      return {
        ...currentCart,
        ...updateCartTotals(updatedLines),
        lines: updatedLines
      };
    }
    case 'ADD_ITEM': {
      const { variant, product, quantity } = action.payload;
      console.log('[cartReducer] ADD_ITEM', variant.id, 'qty', quantity);
      const existingItem = currentCart.lines.find(
        (item) => item.merchandise.id === variant.id
      );
      const updatedItem = createOrUpdateCartItem(existingItem, variant, product, quantity);

      const updatedLines = existingItem
        ? currentCart.lines.map((item) =>
            item.merchandise.id === variant.id ? updatedItem : item
          )
        : [...currentCart.lines, updatedItem];

      return {
        ...currentCart,
        ...updateCartTotals(updatedLines),
        lines: updatedLines
      };
    }
    default:
      return currentCart;
  }
}

export function CartProvider({
  children,
  cart
}: {
  children: React.ReactNode;
  cart: Cart | undefined;
}) {
  const initialCart: Cart = cart ?? createEmptyCart();
  const [cartState, dispatch] = useReducer(cartReducer, initialCart);
  const [checkoutUrl, setCheckoutUrl] = useState<string>('');
  const [cartId, setCartId] = useState<string>('');

  // Hydrate from localStorage (empty initial to avoid hydration mismatch)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Cart;
        if (parsed) {
          dispatch({ type: 'HYDRATE', payload: parsed });
          setCheckoutUrl(parsed.checkoutUrl || '');
          setCartId(parsed.id || '');
        }
      } catch (err) {
        console.warn('[CartProvider] failed to hydrate cart', err);
      }
    }
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          ...cartState,
          checkoutUrl: checkoutUrl || cartState.checkoutUrl || '',
          id: cartId || cartState.id
        })
      );
    } catch (err) {
      console.warn('[CartProvider] failed to persist cart', err);
    }
  }, [cartState, checkoutUrl, cartId]);

  const syncShopifyCart = async (lines: { merchandiseId: string; quantity: number }[]) => {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        if (data.cartId) {
          setCartId(data.cartId);
          localStorage.setItem('shopifyCartId', data.cartId);
        }
        if (data.checkoutUrl) {
          setCheckoutUrl(data.checkoutUrl);
          localStorage.setItem('shopifyCheckoutUrl', data.checkoutUrl);
        }
      }
    } catch (err) {
      console.warn('[CartProvider] failed to sync Shopify cart', err);
    }
  };

  const updateCartItemHandler = (merchandiseId: string, updateType: UpdateType) => {
    // compute next lines for sync
    const nextLines = cartState.lines
      .map((item) =>
        item.merchandise.id === merchandiseId ? updateCartItem(item, updateType) : item
      )
      .filter(Boolean) as CartItem[];
    const payloadLines = nextLines.map((item) => ({
      merchandiseId: item.merchandise.id,
      quantity: item.quantity
    }));
    syncShopifyCart(payloadLines);

    dispatch({
      type: 'UPDATE_ITEM',
      payload: { merchandiseId, updateType }
    });
  };

  const addCartItem = (variant: ProductVariant, product: Product, quantity: number = 1) => {
    const existingItem = cartState.lines.find((item) => item.merchandise.id === variant.id);
    const updatedItem = createOrUpdateCartItem(existingItem, variant, product, quantity);
    const nextLines = existingItem
      ? cartState.lines.map((item) => (item.merchandise.id === variant.id ? updatedItem : item))
      : [...cartState.lines, updatedItem];
    const payloadLines = nextLines.map((item) => ({
      merchandiseId: item.merchandise.id,
      quantity: item.quantity
    }));
    syncShopifyCart(payloadLines);

    dispatch({ type: 'ADD_ITEM', payload: { variant, product, quantity } });
    toast('Added to cart');
  };

  return (
    <CartContext.Provider
      value={{
        cart: { ...cartState, checkoutUrl: checkoutUrl || cartState.checkoutUrl || '', id: cartId || cartState.id },
        updateCartItem: updateCartItemHandler,
        addCartItem
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
