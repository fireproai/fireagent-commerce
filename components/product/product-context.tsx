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
  updateOption: (optionName: string, value: string) => ProductState;
};

const ProductContext = createContext<ProductContextType | undefined>(
  undefined
);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Convert URL params to initial state
  const initialState: ProductState = useMemo(() => {
    const entries = Array.from(searchParams.entries());
    return Object.fromEntries(entries);
  }, [searchParams]);

  // Product option state (stable in React 18)
  const [state, setState] = useState<ProductState>(initialState);

  function updateState(updates: ProductState) {
    const next = { ...state, ...updates };
    setState(next);

    const params = new URLSearchParams(next);
    router.replace(`?${params.toString()}`);
  }

  function updateImage(index: number) {
    updateState({ image: String(index) });
  }

  // ⭐ NEW: VariantSelector expects updateOption()
  function updateOption(optionName: string, value: string) {
    const updates = { [optionName]: value };
    updateState(updates);
    return { ...state, ...updates }; // returned so VariantSelector can pass this to updateURL()
  }

  return (
    <ProductContext.Provider
      value={{
        state,
        updateState,
        updateImage,
        updateOption
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

// Used by Gallery & VariantSelector to update URL params
export function useUpdateURL() {
  const { updateState } = useProduct();
  return (updates: Record<string, string>) => updateState(updates);
}
