"use client";

import React from "react";
import { toast } from "sonner";

import { SkuTitle } from "components/product/SkuTitle";
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
    items?: Array<{
      label: string;
      slug: string;
      skuCount?: number;
    }>;
  }>;
};

type LinePayload = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
  product?: QuickBuilderProduct;
};

type Props = {
  open: boolean;
  mode: "cart" | "quote";
  products: QuickBuilderProduct[];
  onApplyLines: (lines: LinePayload[]) => Promise<void> | void;
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
  const root = slugify(product.nav_root || "");
  const group = slugify(product.nav_group || "");
  const group1 = slugify(product.nav_group_1 || "");
  if (selection.root && selection.root !== root) return false;
  if (selection.group && selection.group !== group) return false;
  if (selection.group1 && selection.group1 !== group1) return false;
  return true;
}

export function CataloguePicker({ open, mode, products, onApplyLines, onClose }: Props) {
  const [navOptions, setNavOptions] = React.useState<NavOption[]>([]);
  const [loadingNav, setLoadingNav] = React.useState(false);
  const [navError, setNavError] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<NavSelection>({});
  const [pendingQuery, setPendingQuery] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [quantity, setQuantity] = React.useState("1");
  const navFetchStartedRef = React.useRef(false);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const qtyRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    // Dependency list intentionally uses stable scalars to avoid re-running on render (prevents fetch loop)
    if (!open) {
      navFetchStartedRef.current = false;
      if (loadingNav) setLoadingNav(false);
      return;
    }
    if (navFetchStartedRef.current) return;
    if (loadingNav) return;
    if (navOptions.length) return;
    navFetchStartedRef.current = true;
    const controller = new AbortController();
    let isActive = true;
    setLoadingNav(true);
    fetch("/api/nav", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!isActive || controller.signal.aborted) return;
        const roots = Array.isArray(data?.slug_map?.roots) ? (data.slug_map.roots as NavOption[]) : [];
        setNavOptions(roots);
      })
      .catch((err) => {
        if (!isActive || controller.signal.aborted) return;
        setNavError("Could not load catalogue navigation");
      })
      .finally(() => {
        if (!isActive || controller.signal.aborted) return;
        setLoadingNav(false);
      });
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [loadingNav, navOptions.length, open]);

  React.useEffect(() => {
    const t = setTimeout(() => setQuery(pendingQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [pendingQuery]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query, selection.root, selection.group, selection.group1]);

  if (!open) return null;

  const scopeLabel = selection.root
    ? navOptions.find((root) => root.slug === selection.root)?.label || "Scoped"
    : null;

  const flatResults = React.useMemo(() => {
    const scored = products
      .map((product) => {
        if (!matchesSelection(product, selection)) return null;
        const score = scoreProduct(product, query);
        if (query && score === 0) return null;
        return {
          product,
          score,
          brandSlug: slugify(product.nav_root || "other"),
          brandLabel: product.nav_root || "Other",
        };
      })
      .filter(Boolean) as Array<{ product: QuickBuilderProduct; score: number; brandSlug: string; brandLabel: string }>;

    return scored
      .sort((a, b) => {
        const scoreDelta = b.score - a.score;
        if (scoreDelta !== 0) return scoreDelta;
        return a.product.sku.localeCompare(b.product.sku);
      })
      .slice(0, 100);
  }, [products, query, selection]);

  const groupedResults = React.useMemo(() => {
    if (selection.root) {
      const label = scopeLabel || selection.root;
      return [{ brandSlug: selection.root, brandLabel: label, items: flatResults }];
    }
    const map = new Map<
      string,
      { brandSlug: string; brandLabel: string; items: Array<{ product: QuickBuilderProduct; score: number }> }
    >();
    flatResults.forEach((entry) => {
      if (!map.has(entry.brandSlug)) {
        map.set(entry.brandSlug, { brandSlug: entry.brandSlug, brandLabel: entry.brandLabel, items: [] });
      }
      map.get(entry.brandSlug)!.items.push(entry);
    });
    return Array.from(map.values());
  }, [flatResults, selection.root, scopeLabel]);

  const selectedEntry = flatResults[selectedIndex] ?? flatResults[0] ?? null;

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(flatResults.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatResults.length === 0) return;
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        qtyRef.current?.focus();
        qtyRef.current?.select();
      });
    }
  };

  const onQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleDirectAdd();
    } else if (e.key === "Escape") {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
  };

  const normalizedQty = Math.max(1, Math.min(999, parseInt(quantity || "1", 10) || 1));

  const handleDirectAdd = async () => {
    if (!selectedEntry) return;
    const product = selectedEntry.product;
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
    const price = Number(product.price ?? 0);
    const unitPrice = Number.isFinite(price) ? Number(price.toFixed(2)) : 0;
    await Promise.resolve(
      onApplyLines([
        {
          sku: product.sku,
          name: product.name || product.sku,
          qty: normalizedQty,
          unit_price_ex_vat: unitPrice,
          product,
        },
      ]),
    );
    toast.success(`Added ${normalizedQty} x ${product.sku} to ${mode === "quote" ? "quote" : "cart"}`);
    setQuantity("1");
    searchRef.current?.focus();
    searchRef.current?.select();
  };

  const brandTiles = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {navOptions.map((root) => (
        <button
          key={root.slug}
          type="button"
          onClick={() => setSelection({ root: root.slug, group: null, group1: null })}
          className="group flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
        >
          <div className="space-y-1">
            <p className="text-lg font-semibold text-neutral-900">{root.label}</p>
            <p className="text-sm text-neutral-600">
              {root.skuCount} SKU{root.skuCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1 text-xs text-neutral-500">
            {root.groups.slice(0, 6).map((group) => (
              <span
                key={group.slug}
                className="rounded-full bg-neutral-100 px-2 py-1 transition group-hover:bg-neutral-200"
              >
                {group.label}
              </span>
            ))}
            {root.groups.length > 6 ? <span className="text-neutral-400">+{root.groups.length - 6} more</span> : null}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <div className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">
              {mode === "quote" ? "Build your quote" : "Add to cart"}
            </h2>
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

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-neutral-700" htmlFor="catalogue-search">
            Search catalogue
          </label>
          <input
            id="catalogue-search"
            ref={searchRef}
            value={pendingQuery}
            onChange={(e) => setPendingQuery(e.currentTarget.value)}
            onKeyDown={onSearchKeyDown}
          placeholder="Search by SKU or product name"
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
      </div>

      {!selection.root ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            {loadingNav ? <span className="text-xs text-neutral-600">Loading navigation...</span> : null}
            {navError ? <span className="text-xs text-red-700">{navError}</span> : null}
          </div>
          {brandTiles}
        </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-neutral-700">
              <button
                type="button"
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
                onClick={() => setSelection({})}
              >
                Back to all brands
              </button>
              <span className="text-neutral-500">Scope: {scopeLabel}</span>
            </div>
            {loadingNav ? <span className="text-xs text-neutral-600">Loading navigation...</span> : null}
            {navError ? <span className="text-xs text-red-700">{navError}</span> : null}
          </div>
        )}

        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 rounded-lg border border-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800">
              <span>Results ({flatResults.length})</span>
              {selection.root && scopeLabel ? <span className="text-xs font-medium text-neutral-600">{scopeLabel}</span> : null}
            </div>
            <div className="max-h-[420px] divide-y divide-neutral-200 overflow-y-auto">
              {groupedResults.map((group) => (
                <div key={group.brandSlug} className="bg-neutral-50/40">
                  <div className="sticky top-0 z-10 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-600">
                    {group.brandLabel}
                  </div>
                  {group.items.map((entry) => {
                    const globalIndex = flatResults.findIndex((res) => res.product.sku === entry.product.sku);
                    const isSelected = globalIndex === selectedIndex;
                    const availability = getAvailabilityState({
                      merchandiseId: entry.product.merchandiseId,
                      requiresQuote: entry.product.requires_quote,
                      discontinued: false,
                    });
                    const canAdd = mode === "quote" ? availability !== "discontinued" : canAddToCart(availability);
                    return (
                      <button
                        key={entry.product.sku}
                        type="button"
                        onClick={() => {
                          setSelectedIndex(globalIndex);
                          setQuantity("1");
                          requestAnimationFrame(() => {
                            qtyRef.current?.focus();
                            qtyRef.current?.select();
                          });
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm transition ${
                          isSelected ? "bg-neutral-50 border-l-4 border-l-neutral-900" : "hover:bg-neutral-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <SkuTitle
                            sku={entry.product.sku}
                            title={entry.product.name}
                            size="sm"
                            variant="list"
                            className="min-w-0"
                          />
                          <p className="text-xs text-neutral-600">
                            {formatPrice(entry.product.price)} {availability === "quote_only" ? "(quote only)" : ""}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-neutral-600">
                          {canAdd ? "Ready" : "Unavailable"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {flatResults.length === 0 ? (
                <p className="px-3 py-3 text-sm text-neutral-600">No matches found.</p>
              ) : null}
            </div>
            <div className="border-t border-neutral-200 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-neutral-800">Browse catalogue</h4>
                <button
                  type="button"
                  className="text-xs font-semibold text-neutral-700 hover:underline"
                  onClick={() => setSelection({})}
                >
                  All products
                </button>
              </div>
              <div className="mt-2 space-y-2">
                <div className="space-y-1">
                  {navOptions.map((root) => {
                    const isRootActive = selection.root === root.slug;
                    const groups = root.groups || [];
                    const showGroups = isRootActive && groups.length > 0;
                    return (
                      <div key={root.slug} className="space-y-1">
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs font-semibold transition ${
                            isRootActive
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-200 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50"
                          }`}
                          onClick={() => setSelection({ root: root.slug, group: null, group1: null })}
                        >
                          <span className="truncate">{root.label}</span>
                          {showGroups ? <span className="text-[11px] font-semibold">−</span> : <span className="text-[11px]">+</span>}
                        </button>
                        {showGroups ? (
                          <div className="pl-3">
                            <div className="space-y-1">
                              {groups.map((group) => {
                                const isGroupActive = selection.group === group.slug;
                                const subgroups = group.items || [];
                                const showSubgroups = isGroupActive && subgroups.length > 0;
                                return (
                                  <div key={group.slug} className="space-y-1">
                                    <button
                                      type="button"
                                      className={`flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                                        isGroupActive
                                          ? "border-neutral-900 bg-neutral-900 text-white"
                                          : "border-neutral-200 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50"
                                      }`}
                                      onClick={() =>
                                        setSelection({ root: selection.root, group: group.slug, group1: null })
                                      }
                                    >
                                      <span className="truncate">{group.label}</span>
                                      {showSubgroups ? (
                                        <span className="text-[11px] font-semibold">−</span>
                                      ) : (
                                        subgroups.length > 0 && <span className="text-[11px]">+</span>
                                      )}
                                    </button>
                                    {showSubgroups ? (
                                      <div className="pl-3">
                                        <div className="flex flex-wrap gap-2">
                                          {subgroups.map((item) => {
                                            const isSubActive = selection.group1 === item.slug;
                                            return (
                                              <button
                                                key={item.slug}
                                                type="button"
                                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                                  isSubActive
                                                    ? "border-neutral-900 bg-neutral-900 text-white"
                                                    : "border-neutral-200 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50"
                                                }`}
                                                onClick={() =>
                                                  setSelection({
                                                    root: selection.root,
                                                    group: selection.group,
                                                    group1: item.slug,
                                                  })
                                                }
                                              >
                                                {item.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-neutral-200 p-3 lg:w-[360px] lg:flex-shrink-0">
            <div className="text-sm font-semibold text-neutral-800">Selected item</div>
            {selectedEntry ? (
              <div className="space-y-2 pt-2">
                <SkuTitle
                  sku={selectedEntry.product.sku}
                  title={selectedEntry.product.name}
                  size="md"
                  variant="list"
                  className="min-w-0"
                />
                <p className="text-sm font-medium text-neutral-800">{formatPrice(selectedEntry.product.price)}</p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-neutral-700" htmlFor="catalogue-qty">
                    Quantity
                  </label>
                  <input
                    id="catalogue-qty"
                    ref={qtyRef}
                    type="number"
                    min={1}
                    max={999}
                    value={quantity}
                    onChange={(e) => setQuantity(e.currentTarget.value)}
                    onKeyDown={onQtyKeyDown}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-24 rounded-md border border-neutral-300 px-2 py-2 text-sm text-neutral-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                  />
                  <button
                    type="button"
                    onClick={handleDirectAdd}
                    className="inline-flex w-full items-center justify-center rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                  >
                    {mode === "quote" ? "Add to quote" : "Add to cart"}
                  </button>
                </div>
                <p className="text-xs text-neutral-600">
                  Adds immediately to your {mode === "quote" ? "quote builder" : "cart"}. Enter confirms quickly.
                </p>
              </div>
            ) : (
              <p className="text-sm text-neutral-600">Search or browse to pick an item.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
