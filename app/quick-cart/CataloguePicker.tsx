"use client";

import React from "react";
import { toast } from "sonner";

import { canAddToCart, getAvailabilityState } from "lib/commercialState";
import { QuickBuilderProduct } from "lib/quick/products";
import { slugify } from "lib/plytix/slug";

type NavOption = {
  label: string;
  slug: string;
  skuCount?: number;
  groups: Array<{
    label: string;
    slug: string;
    skuCount?: number;
    items: Array<{
      label: string;
      slug: string;
      skuCount?: number;
      items: Array<{
        label: string;
        slug: string;
        skuCount?: number;
      }>;
    }>;
  }>;
};

type Props = {
  open: boolean;
  mode: "cart" | "quote";
  products: QuickBuilderProduct[];
  onAdd: (product: QuickBuilderProduct) => Promise<void> | void;
  onClose?: () => void;
};

type NavSelection = { root?: string | null; group?: string | null; group1?: string | null };

function formatPrice(price?: number | null) {
  if (price === null || price === undefined) return "Login to see price";
  const value = Number(price);
  if (!Number.isFinite(value)) return "Login to see price";
  return `\u00a3${value.toFixed(2)}`;
}

function scoreProduct(product: QuickBuilderProduct, query: string) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const name = (product.name || "").toLowerCase();
  const sku = (product.sku || "").toLowerCase();
  if (sku === q) return 400;
  if (sku.startsWith(q)) return 320;
  if (sku.includes(q)) return 260;
  if (name.startsWith(q)) return 200;
  if (name.includes(q)) return 160;
  return 0;
}

function matchesSelection(product: QuickBuilderProduct, selection: NavSelection) {
  if (!selection.root && !selection.group && !selection.group1) return true;
  const root = slugify(product.nav_root || "");
  const group = slugify(product.nav_group || "");
  const group1 = slugify(product.nav_group_1 || "");
  if (selection.root && selection.root !== root) return false;
  if (selection.group && selection.group !== group) return false;
  if (selection.group1 && selection.group1 !== group1) return false;
  return true;
}

export function CataloguePicker({ open, mode, products, onAdd, onClose }: Props) {
  const [navOptions, setNavOptions] = React.useState<NavOption[]>([]);
  const [loadingNav, setLoadingNav] = React.useState(false);
  const [navError, setNavError] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<NavSelection>({});
  const [pendingQuery, setPendingQuery] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [addingSku, setAddingSku] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (navOptions.length) return;
    setLoadingNav(true);
    fetch("/api/nav")
      .then((res) => res.json())
      .then((data) => {
        const roots = Array.isArray(data?.slug_map?.roots) ? (data.slug_map.roots as NavOption[]) : [];
        setNavOptions(roots);
        if (roots[0]) {
          setSelection({ root: roots[0].slug });
        }
      })
      .catch(() => setNavError("Could not load catalogue navigation"))
      .finally(() => setLoadingNav(false));
  }, [navOptions.length, open]);

  React.useEffect(() => {
    const t = setTimeout(() => setQuery(pendingQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [pendingQuery]);

  const results = React.useMemo(() => {
    return products
      .map((product) => {
        if (!matchesSelection(product, selection)) return null;
        const score = scoreProduct(product, query);
        if (query && score === 0) return null;
        return { product, score };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const scoreDelta = (b as any).score - (a as any).score;
        if (scoreDelta !== 0) return scoreDelta;
        return (a as any).product.sku.localeCompare((b as any).product.sku);
      })
      .slice(0, 50)
      .map((entry: any) => entry.product as QuickBuilderProduct);
  }, [products, query, selection]);

  const selectionLabel = React.useMemo(() => {
    const root = navOptions.find((item) => item.slug === selection.root);
    const group = root?.groups.find((item) => item.slug === selection.group);
    const group1 = group?.items.find((item) => item.slug === selection.group1);
    return [root?.label, group?.label, group1?.label].filter(Boolean).join(" / ");
  }, [navOptions, selection.group, selection.group1, selection.root]);

  if (!open) return null;

  const handleAdd = async (product: QuickBuilderProduct) => {
    const availability = getAvailabilityState({
      merchandiseId: product.merchandiseId,
      requiresQuote: product.requires_quote,
      discontinued: false,
    });
    const canProceed = mode === "quote" ? availability !== "discontinued" : canAddToCart(availability);
    if (!canProceed) {
      toast.error("This item cannot be added right now.");
      return;
    }
    setAddingSku(product.sku);
    try {
      await onAdd(product);
    } catch (err) {
      toast.error((err as Error)?.message || "Could not add item");
    } finally {
      setAddingSku(null);
    }
  };

  return (
    <div className="w-full">
      <div className="flex w-full flex-col rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500">Add from catalogue</p>
            <h2 className="text-xl font-semibold text-neutral-900">
              {mode === "quote" ? "Build your quote" : "Add to cart"}
            </h2>
            <p className="text-sm text-neutral-600">Browse by navigation or search SKUs. Click Add to insert 1 item.</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Close
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 border-b border-neutral-200 px-4 py-3 lg:grid-cols-[320px_1fr]">
          <div className="min-h-[360px] rounded-lg border border-neutral-200 bg-neutral-50">
            <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
              <span className="text-sm font-semibold text-neutral-800">Catalogue</span>
              <button
                type="button"
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
                onClick={() => setSelection({})}
              >
                Clear
              </button>
            </div>
            <div className="max-h-[440px] space-y-3 overflow-auto px-3 py-2">
              {loadingNav ? <p className="text-sm text-neutral-600">Loading navigation...</p> : null}
              {navError ? <p className="text-sm text-red-700">{navError}</p> : null}
              {navOptions.map((root) => (
                <div key={root.slug} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setSelection({ root: root.slug })}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-sm font-semibold ${
                      selection.root === root.slug ? "bg-neutral-900 text-white" : "text-neutral-900 hover:bg-neutral-100"
                    }`}
                  >
                    <span>{root.label}</span>
                    {typeof root.skuCount === "number" ? (
                      <span className="text-xs font-medium">{root.skuCount}</span>
                    ) : null}
                  </button>
                  <div className="space-y-1 pl-2">
                    {root.groups.map((group) => (
                      <div key={group.slug} className="rounded-md px-2 py-1 hover:bg-neutral-100">
                        <button
                          type="button"
                          onClick={() => setSelection({ root: root.slug, group: group.slug })}
                          className={`flex w-full items-center justify-between rounded-md px-1 py-1 text-sm ${
                            selection.group === group.slug ? "bg-neutral-800 text-white" : "text-neutral-800 hover:bg-neutral-200"
                          }`}
                        >
                          <span>{group.label}</span>
                          {typeof group.skuCount === "number" ? (
                            <span className="text-[11px] font-semibold">{group.skuCount}</span>
                          ) : null}
                        </button>
                        <div className="mt-1 space-y-1 pl-2">
                          {group.items.map((child) => (
                            <button
                              key={child.slug}
                              type="button"
                              onClick={() => setSelection({ root: root.slug, group: group.slug, group1: child.slug })}
                              className={`flex w-full items-center justify-between rounded-md px-1 py-1 text-xs ${
                                selection.group1 === child.slug
                                  ? "bg-neutral-700 text-white"
                                  : "text-neutral-700 hover:bg-neutral-200"
                              }`}
                            >
                              <span>{child.label}</span>
                              {typeof child.skuCount === "number" ? (
                                <span className="text-[10px] font-semibold">{child.skuCount}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {navOptions.length === 0 && !loadingNav && !navError ? (
                <p className="text-sm text-neutral-600">Navigation is unavailable right now.</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-700" htmlFor="catalogue-search">
                Search catalogue
              </label>
              <input
                id="catalogue-search"
                value={pendingQuery}
                onChange={(e) => setPendingQuery(e.currentTarget.value)}
                placeholder="Search by SKU or product name"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              <p className="text-xs text-neutral-500">Results filtered by navigation. Debounced for fast typing.</p>
            </div>

            <div className="rounded-lg border border-neutral-200">
              <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800">
                <span>Results ({results.length})</span>
                {selectionLabel ? (
                  <span className="text-xs font-medium text-neutral-600">Scope: {selectionLabel}</span>
                ) : null}
              </div>
              <div className="max-h-[420px] divide-y divide-neutral-200 overflow-auto">
                {results.map((product) => {
                  const availability = getAvailabilityState({
                    merchandiseId: product.merchandiseId,
                    requiresQuote: product.requires_quote,
                    discontinued: false,
                  });
                  const canAdd = mode === "quote" ? availability !== "discontinued" : canAddToCart(availability);
                  return (
                    <div key={product.sku} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-neutral-900">{product.sku}</p>
                        <p className="truncate text-neutral-700">{product.name}</p>
                        <p className="text-xs text-neutral-600">
                          {formatPrice(product.price)} {availability === "quote_only" ? "(quote only)" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canAdd || addingSku === product.sku}
                        onClick={() => handleAdd(product)}
                        className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
                      >
                        {addingSku === product.sku ? "Adding..." : "Add"}
                      </button>
                    </div>
                  );
                })}
                {results.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-neutral-600">No matches found.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-neutral-600">Data-driven navigation from /api/nav. Plytix remains the source of truth.</p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
