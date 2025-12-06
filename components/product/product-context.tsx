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

  // Convert URL params to initial state
  const initialState: ProductState = useMemo(() => {
    const entries = Array.from(searchParams.entries());
    return Object.fromEntries(entries);
  }, [searchParams]);

  // 🔥 React 18-safe optimistic replacement
  const [state, setState] = useState<ProductState>(initialState);

  function updateState(updates: ProductState) {
    setState((prev) => ({ ...prev, ...updates }));

    // Update the URL to reflect new state
    const params = new URLSearchParams({ ...state, ...updates });
    router.replace(`?${params.toString()}`);
  }

  return (
    <ProductContext.Provider value={{ state, updateState }}>
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
