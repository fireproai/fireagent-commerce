"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ProductLite = {
  id: string;
  title: string;
  handle: string;
  skus?: string[];
  image?: string | null;
  priceAmount?: string | number | null;
  currencyCode?: string | null;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      try {
        const res = await fetch(`${baseUrl}/api/products`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          if (active) setProducts([]);
          return;
        }
        const data = await res.json().catch(() => null);
        if (!active) return;
        const list =
          data?.products?.map((p: any) => ({
            id: p.id,
            title: p.title,
            handle: p.handle,
            skus: p.skus,
            image: p.image,
            priceAmount: p.priceAmount,
            currencyCode: p.currencyCode,
          })) || [];
        setProducts(list);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">All Products</h1>
        <span className="text-sm text-neutral-600">
          {loading ? "Loading…" : `${products.length} items`}
        </span>
      </div>

      {products.length === 0 && !loading ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-600">
          No products available.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <li
              key={product.id}
              className="group rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md flex flex-col"
            >
              <Link href={`/product/${product.handle}`} className="flex h-full flex-col gap-3">
                {product.image ? (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image}
                      alt={product.title}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                <div className="mt-auto space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-900 line-clamp-1">
                      {product.skus?.[0] || product.title}
                    </p>
                    {product.priceAmount && product.currencyCode ? (
                      <p className="text-sm font-semibold text-neutral-900">
                        {product.currencyCode} {product.priceAmount}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm text-neutral-600 line-clamp-1">
                    {product.title}
                  </p>
                  {product.skus && product.skus.length > 1 ? (
                    <p className="text-[11px] text-neutral-900">
                      Other SKUs: {product.skus.slice(1).join(", ")}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

