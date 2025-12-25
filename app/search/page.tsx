"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ProductLite = {
  id: string;
  title: string;
  handle: string;
  status?: string;
  skus?: string[];
  priceAmount?: string | number;
  currencyCode?: string;
  family?: string | null;
  vad?: boolean | null;
  colour?: string | null;
  keywords?: string[];
};

type SortKey = "relevance" | "az" | "price-asc" | "price-desc";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialQuery = (searchParams.get("q") || "").toString();
  const initialSort = (searchParams.get("sort") || "relevance") as SortKey;
  const initialFamily = (searchParams.get("family") || "").toString();
  const initialVad = (searchParams.get("vad") || "").toString();
  const initialColour = (searchParams.get("colour") || "").toString();

  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [family, setFamily] = useState(initialFamily);
  const [vad, setVad] = useState(initialVad);
  const [colour, setColour] = useState(initialColour);

  // Fetch products once
  useEffect(() => {
    let active = true;
    const fetchProducts = async () => {
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
            status: p.status,
            skus: p.skus,
            priceAmount: p.variants?.[0]?.priceAmount,
            currencyCode: p.variants?.[0]?.currencyCode,
            family: p.family ?? null,
            vad: typeof p.vad === "boolean" ? p.vad : null,
            colour: p.colour ?? null,
            keywords: p.keywords ?? [],
          })) || [];
        setProducts(list);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchProducts();
    return () => {
      active = false;
    };
  }, []);

  // Debounce query updates and sync URL
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(pendingQuery);

      const params = new URLSearchParams();
      if (pendingQuery) params.set("q", pendingQuery);
      if (sort && sort !== "relevance") params.set("sort", sort);
      if (family) params.set("family", family);
      if (vad) params.set("vad", vad);
      if (colour) params.set("colour", colour);

      const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      const current = `${pathname}?${searchParams.toString()}`;

      if (next !== current) router.replace(next);
    }, 300);

    return () => clearTimeout(t);
  }, [pendingQuery, sort, family, vad, colour, router, pathname]);

  const hasPriceData = useMemo(
    () => products.some((p) => p.priceAmount !== undefined && p.priceAmount !== null),
    [products]
  );

  const filtered = useMemo(() => {
    if (!products.length) return [];
    const q = query.trim().toLowerCase();
    const isSkuish =
      q.length > 0 &&
      (/^\d+$/.test(q) || q.includes("-") || /^s4/i.test(q) || /^s/i.test(q) || /^vig/i.test(q) || /^compact/i.test(q));
    const scored = products.map((p) => {
      let score = 0;
      if (q) {
        const title = (p.title || "").toLowerCase();
        const handle = (p.handle || "").toLowerCase();
        const skus = (p.skus || []).map((s) => (s || "").toLowerCase());
        const kw = (p.keywords || []).join(" ").toLowerCase();
        if (skus.includes(q)) score += 100;
        if (skus.some((s) => s.includes(q))) score += 50;
        if (title.includes(q)) score += 30;
        if (handle.includes(q)) score += 20;
        if (kw && kw.includes(q)) score += 25;
      }
      return { ...p, _score: score, _isSkuish: isSkuish };
    });

    const filteredList = scored.filter((p) => {
      if (family && (p.family || "").toLowerCase() !== family.toLowerCase()) return false;
      if (vad) {
        const boolVal = vad === "yes";
        if (p.vad === null || p.vad === undefined) return false;
        if (Boolean(p.vad) !== boolVal) return false;
      }
      if (colour && (p.colour || "").toLowerCase() !== colour.toLowerCase()) return false;
      return true;
    });

    const sorted = [...filteredList].sort((a, b) => {
      switch (sort) {
        case "az":
          return a.title.localeCompare(b.title);
        case "price-asc": {
          const pa = Number(a.priceAmount ?? Infinity);
          const pb = Number(b.priceAmount ?? Infinity);
          return pa - pb;
        }
        case "price-desc": {
          const pa = Number(a.priceAmount ?? -Infinity);
          const pb = Number(b.priceAmount ?? -Infinity);
          return pb - pa;
        }
        case "relevance":
        default:
          return (b as any)._score - (a as any)._score;
      }
    });

    return sorted;
  }, [products, query, sort, family, vad, colour]);

  const skuMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return filtered
      .map((p) => {
        const skus = (p.skus || []).map((s) => (s || "").toLowerCase());
        const handle = (p.handle || "").toLowerCase();
        const skuHit = skus.find((s) => s.includes(q));
        const handleHit = !skus.length && (handle === q || handle.includes(q));
        if (!skuHit && !handleHit) return null;
        let rank = 0;
        if (skus.includes(q)) rank = 3;
        else if (skus.some((s) => s.startsWith(q))) rank = 2;
        else if (skuHit || handleHit) rank = 1;
        return { ...p, _rank: rank };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b._rank - a._rank || (b as any)._score - (a as any)._score) as ProductLite[];
  }, [filtered, query]);

  const otherMatches = useMemo(() => {
    const skuIds = new Set(skuMatches.map((p) => p.id));
    return filtered.filter((p) => !skuIds.has(p.id));
  }, [filtered, skuMatches]);

  const [showOther, setShowOther] = useState(skuMatches.length === 0);

  const sortOptions: { value: SortKey; label: string; disabled?: boolean }[] = [
    { value: "relevance", label: "Relevance" },
    { value: "price-asc", label: "Price: Low to High", disabled: !hasPriceData },
    { value: "price-desc", label: "Price: High to Low", disabled: !hasPriceData },
    { value: "az", label: "A–Z" },
  ];

  const familyOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.family) set.add(p.family);
    });
    return Array.from(set);
  }, [products]);

  const colourOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.colour) set.add(p.colour);
    });
    return Array.from(set);
  }, [products]);

  const hasVad = useMemo(() => products.some((p) => p.vad !== null && p.vad !== undefined), [
    products,
  ]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <input
            value={pendingQuery}
            onChange={(e) => setPendingQuery(e.target.value)}
            name="q"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
            placeholder="Search by SKU, name, or handle"
            aria-label="Search"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="sort" className="text-neutral-600">
            Sort
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
                {opt.disabled ? " (unavailable)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {familyOptions.length > 0 ? (
          <label className="flex items-center gap-2">
            <span className="text-neutral-600">Family</span>
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {familyOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {hasVad ? (
          <label className="flex items-center gap-2">
            <span className="text-neutral-600">VAD</span>
            <select
              value={vad}
              onChange={(e) => setVad(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        ) : null}

        {colourOptions.length > 0 ? (
          <label className="flex items-center gap-2">
            <span className="text-neutral-600">Colour</span>
            <select
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {colourOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-600">
        <span>{loading ? "Loading…" : `${filtered.length} results`}</span>
      </div>

      {filtered.length === 0 && !loading ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-600">
          No products found. Try searching by SKU (e.g., S4-911-V-VAD-HPR) or product name.
        </p>
      ) : null}

      {skuMatches.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-700">
            SKU matches ({skuMatches.length})
          </h2>
          <ul className="space-y-3">
            {skuMatches.map((product) => (
              <ResultCard key={product.id} product={product} />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">
            Other results ({otherMatches.length})
          </h2>
          {skuMatches.length > 0 && otherMatches.length > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:underline"
              onClick={() => setShowOther((prev) => !prev)}
            >
              {showOther ? "Hide" : "Show"} other results
            </button>
          ) : null}
        </div>
        {showOther || skuMatches.length === 0 ? (
          otherMatches.length > 0 ? (
            <ul className="space-y-3">
              {otherMatches.map((product) => (
                <ResultCard key={product.id} product={product} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-900">No other results.</p>
          )
        ) : null}
      </div>
    </section>
  );
}

function ResultCard({ product }: { product: ProductLite }) {
  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`/product/${product.handle}`}
        className="text-lg font-semibold text-blue-600 hover:underline"
      >
        {product.title}
      </Link>
      <p className="text-sm text-neutral-900">{product.handle}</p>
      {product.skus?.length ? (
        <p className="text-xs text-neutral-900">SKUs: {product.skus.join(", ")}</p>
      ) : null}
    </li>
  );
}

