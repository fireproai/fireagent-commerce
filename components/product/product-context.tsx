'use client';

import React, {
  createContext,
  useContext,
  useMemo,
  useState
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type ProductState = {
  [key: string]: string;
};

type ProductContextType = {
  state: ProductState;
  updateState: (updates: ProductState) => void;
  updateImage: (index: number) => void;
};

const ProductContext = createContext<ProductContextType | undefined>(
  undefined
);

export function ProductProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Load initial state from URL
  const initialState: ProductState = useMemo(() => {
    const entries = Array.from(searchParams.entries());
    return Object.fromEntries(entries);
  }, [searchParams]);

  // Stable React 18 state for product UI
  const [state, setState] = useState<ProductState>(initialState);

  function updateState(updates: ProductState) {
    const next = { ...state, ...updates };
    setState(next);

    const params = new URLSearchParams(next);
    router.replace(`?${params.toString()}`);
  }

  // ⭐ NEW: implement missing updateImage()
  function updateImage(index: number) {
    updateState({ image: String(index) });
  }

  return (
    <ProductContext.Provider
      value={{
        state,
        updateState,
        updateImage
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProduct must be used within a ProductProvider');
  }
  return context;
}

// Keeps expected behavior for VariantSelector & Gallery
export function useUpdateURL() {
  const { updateState } = useProduct();
  return (updates: Record<string, string>) => updateState(updates);
}
