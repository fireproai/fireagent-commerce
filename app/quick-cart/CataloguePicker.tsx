"use client";

import React from "react";
import { toast } from "sonner";

import { canAddToCart, getAvailabilityState } from "lib/commercialState";
import { QuickBuilderProduct } from "lib/quick/products";
import { slugify } from "lib/plytix/slug";
import { MONEY_FALLBACK_CURRENCY, coerceAmount, formatMoney } from "lib/money";
import { splitTitleOnFirstDot } from "lib/text/splitTitleOnFirstDot";

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
  storageScope: "qq" | "qc";
  products: QuickBuilderProduct[];
  onApplyLines: (lines: LinePayload[]) => Promise<void> | void;
  currency: string;
  onClose?: () => void;
};

type Scope = {
  nav_root?: string | null;
  nav_group?: string | null;
  nav_group_1?: string | null;
  nav_group_2?: string | null;
};

type NavCrumb =
  | { type: "all"; label: string }
  | { type: "nav_root" | "nav_group" | "nav_group_1" | "nav_group_2"; slug: string; label: string };

type Option = { slug: string; label: string; count: number };

type NavLabelLookup = {
  root: Record<string, string>;
  group: Record<string, Record<string, string>>;
  group1: Record<string, Record<string, Record<string, string>>>;
  group2: Record<string, Record<string, Record<string, Record<string, string>>>>;
};

const QQ_CATALOGUE_SCOPE_KEY = "fa.qq.catalogueScope.v1";
const QC_CATALOGUE_SCOPE_KEY = "fa.qc.catalogueScope.v1";

function normalizeNavValue(value?: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return slugify(trimmed);
}

function buildNavLabelLookup(navOptions: NavOption[]): NavLabelLookup {
  const root: Record<string, string> = {};
  const group: Record<string, Record<string, string>> = {};
  const group1: Record<string, Record<string, Record<string, string>>> = {};
  const group2: Record<string, Record<string, Record<string, Record<string, string>>>> = {};

  navOptions.forEach((r) => {
    root[r.slug] = r.label;
    const groupMap = (group[r.slug] = group[r.slug] || {});
    const group1Map = (group1[r.slug] = group1[r.slug] || {});
    r.groups.forEach((g) => {
      groupMap[g.slug] = g.label;
      const g1Map = (group1Map[g.slug] = group1Map[g.slug] || {});
      (g.items || []).forEach((g1) => {
        g1Map[g1.slug] = g1.label;
      });
    });
  });

  return { root, group, group1, group2 };
}

function buildNavOptionMaps(products: QuickBuilderProduct[], navLabelLookup: NavLabelLookup) {
  const rootMap = new Map<string, Option>();
  const groupMap = new Map<string, Map<string, Option>>();
  const group1Map = new Map<string, Map<string, Map<string, Option>>>();
  const group2Map = new Map<string, Map<string, Map<string, Map<string, Option>>>>();

  const ensure = <T,>(map: Map<string, T>, key: string, create: () => T): T => {
    let value = map.get(key);
    if (!value) {
      value = create();
      map.set(key, value);
    }
    return value;
  };
  const bumpOption = (map: Map<string, Option>, slug: string, label: string) => {
    let opt = map.get(slug);
    if (!opt) {
      opt = { slug, label, count: 0 };
      map.set(slug, opt);
    }
    opt.count += 1;
  };

  products.forEach((product) => {
    const rootSlug = normalizeNavValue(product.nav_root);
    const groupSlug = normalizeNavValue(product.nav_group);
    const group1Slug = normalizeNavValue(product.nav_group_1);
    const group2Slug = normalizeNavValue(product.nav_group_2);

    const rootLabel = rootSlug ? navLabelLookup.root[rootSlug] ?? product.nav_root ?? rootSlug : null;
    const groupLabel =
      rootSlug && groupSlug ? navLabelLookup.group[rootSlug]?.[groupSlug] ?? product.nav_group ?? groupSlug : null;
    const group1Label =
      rootSlug && groupSlug && group1Slug
        ? navLabelLookup.group1[rootSlug]?.[groupSlug]?.[group1Slug] ?? product.nav_group_1 ?? group1Slug
        : null;
    const group2Label =
      rootSlug && groupSlug && group1Slug && group2Slug
        ? navLabelLookup.group2[rootSlug]?.[groupSlug]?.[group1Slug]?.[group2Slug] ??
          product.nav_group_2 ??
          group2Slug
        : null;

    if (rootSlug && rootLabel) {
      bumpOption(rootMap, rootSlug, rootLabel);
    }
    if (rootSlug && groupSlug && groupLabel) {
      const mapForRoot = ensure(groupMap, rootSlug, () => new Map<string, Option>());
      bumpOption(mapForRoot, groupSlug, groupLabel);
    }
    if (rootSlug && groupSlug && group1Slug && group1Label) {
      const mapForRoot = ensure(group1Map, rootSlug, () => new Map<string, Map<string, Option>>());
      const mapForGroup = ensure(mapForRoot, groupSlug, () => new Map<string, Option>());
      bumpOption(mapForGroup, group1Slug, group1Label);
    }
    if (rootSlug && groupSlug && group1Slug && group2Slug && group2Label) {
      const mapForRoot = ensure(
        group2Map,
        rootSlug,
        () => new Map<string, Map<string, Map<string, Option>>>(),
      );
      const mapForGroup = ensure(mapForRoot, groupSlug, () => new Map<string, Map<string, Option>>());
      const mapForGroup1 = ensure(mapForGroup, group1Slug, () => new Map<string, Option>());
      bumpOption(mapForGroup1, group2Slug, group2Label);
    }
  });

  const mapToArray = (map: Map<string, Option>) =>
    Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));

  const groupOptionsByRoot = new Map<string, Option[]>(
    Array.from(groupMap.entries()).map(([rootSlug, map]) => [rootSlug, mapToArray(map)]),
  );
  const group1OptionsByPath = new Map<string, Map<string, Option[]>>(
    Array.from(group1Map.entries()).map(([rootSlug, gMap]) => [
      rootSlug,
      new Map(Array.from(gMap.entries()).map(([groupSlug, map]) => [groupSlug, mapToArray(map)])),
    ]),
  );
  const group2OptionsByPath = new Map<string, Map<string, Map<string, Option[]>>>(
    Array.from(group2Map.entries()).map(([rootSlug, gMap]) => [
      rootSlug,
      new Map(
        Array.from(gMap.entries()).map(([groupSlug, g1Map]) => [
          groupSlug,
          new Map(Array.from(g1Map.entries()).map(([group1Slug, map]) => [group1Slug, mapToArray(map)])),
        ]),
      ),
    ]),
  );

  const labelLookups = {
    root: Object.fromEntries(Array.from(rootMap.entries()).map(([slug, opt]) => [slug, opt.label])),
    group: Object.fromEntries(
      Array.from(groupMap.entries()).map(([rootSlug, gMap]) => [
        rootSlug,
        Object.fromEntries(Array.from(gMap.entries()).map(([slug, opt]) => [slug, opt.label])),
      ]),
    ),
    group1: Object.fromEntries(
      Array.from(group1Map.entries()).map(([rootSlug, gMap]) => [
        rootSlug,
        Object.fromEntries(
          Array.from(gMap.entries()).map(([groupSlug, g1Map]) => [
            groupSlug,
            Object.fromEntries(Array.from(g1Map.entries()).map(([slug, opt]) => [slug, opt.label])),
          ]),
        ),
      ]),
    ),
    group2: Object.fromEntries(
      Array.from(group2Map.entries()).map(([rootSlug, gMap]) => [
        rootSlug,
        Object.fromEntries(
          Array.from(gMap.entries()).map(([groupSlug, g1Map]) => [
            groupSlug,
            Object.fromEntries(
              Array.from(g1Map.entries()).map(([group1Slug, g2Map]) => [
                group1Slug,
                Object.fromEntries(Array.from(g2Map.entries()).map(([slug, opt]) => [slug, opt.label])),
              ]),
            ),
          ]),
        ),
      ]),
    ),
  };

  return {
    rootOptions: mapToArray(rootMap),
    groupOptionsByRoot,
    group1OptionsByPath,
    group2OptionsByPath,
    labelLookups,
  };
}

type BrowseSort = "popular" | "asc" | "desc";

function sortOptions(options: Option[], sort: BrowseSort, level: "root" | "group" | "group1" | "group2") {
  if (sort === "asc") return [...options].sort((a, b) => a.label.localeCompare(b.label));
  if (sort === "desc") return [...options].sort((a, b) => b.label.localeCompare(a.label));
  if (level === "root") {
    const gentSlug = options.find((opt) => opt.label.toLowerCase() === "gent by honeywell")?.slug;
    const pinned = gentSlug ? options.filter((opt) => opt.slug === gentSlug) : [];
    const rest = options.filter((opt) => !gentSlug || opt.slug !== gentSlug).sort((a, b) => a.label.localeCompare(b.label));
    return [...pinned, ...rest];
  }
  return [...options].sort((a, b) => a.label.localeCompare(b.label));
}

function formatPrice(price: number | null | undefined, currency: string) {
  if (price === null || price === undefined) return "Login to see price";
  const value = coerceAmount(price);
  if (!Number.isFinite(value as number) || value === null) return "Login to see price";
  return formatMoney(value, currency);
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

function matchesSelection(product: QuickBuilderProduct, selection: Scope) {
  const root = normalizeNavValue(product.nav_root);
  const group = normalizeNavValue(product.nav_group);
  const group1 = normalizeNavValue(product.nav_group_1);
  const group2 = normalizeNavValue(product.nav_group_2);
  if (selection.nav_root && selection.nav_root !== root) return false;
  if (selection.nav_group && selection.nav_group !== group) return false;
  if (selection.nav_group_1 && selection.nav_group_1 !== group1) return false;
  if (selection.nav_group_2 && selection.nav_group_2 !== group2) return false;
  return true;
}

export function CataloguePicker({ open, mode, storageScope, products, onApplyLines, onClose, currency }: Props) {
  const [navOptions, setNavOptions] = React.useState<NavOption[]>([]);
  const [loadingNav, setLoadingNav] = React.useState(false);
  const [navError, setNavError] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<Scope>({});
  const [pendingQuery, setPendingQuery] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [quantity, setQuantity] = React.useState("1");
  const [searchAllProducts, setSearchAllProducts] = React.useState(false);
  const [browseSort, setBrowseSort] = React.useState<BrowseSort>("popular");
  const navFetchStartedRef = React.useRef(false);
  const autoScopeAppliedRef = React.useRef(false);
  const hydrationRef = React.useRef(false);
  const didHydrateRef = React.useRef(false);
  const explicitAllProductsRef = React.useRef(false);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const qtyRef = React.useRef<HTMLInputElement | null>(null);
  const resultsListRef = React.useRef<HTMLDivElement | null>(null);
  const navLabelLookup = React.useMemo(() => buildNavLabelLookup(navOptions), [navOptions]);
  const {
    rootOptions,
    groupOptionsByRoot,
    group1OptionsByPath,
    group2OptionsByPath,
    labelLookups,
  } = React.useMemo(() => buildNavOptionMaps(products, navLabelLookup), [products, navLabelLookup]);
  const storageKey = storageScope === "qq" ? QQ_CATALOGUE_SCOPE_KEY : QC_CATALOGUE_SCOPE_KEY;


  React.useEffect(() => {
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
      .catch(() => {
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
    if (open) return;
    hydrationRef.current = false;
    didHydrateRef.current = false;
  }, [open]);

  const persistQueryNow = React.useCallback(
    (nextQuery: string) => {
      if (typeof window === "undefined") return;
      try {
        const raw = window.sessionStorage.getItem(storageKey);
        const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        window.sessionStorage.setItem(storageKey, JSON.stringify({ ...parsed, q: nextQuery }));
      } catch {
        // Ignore storage persistence errors.
      }
    },
    [storageKey],
  );
  React.useEffect(() => {
    if (!open || hydrationRef.current) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { scope?: Scope; allProducts?: boolean; q?: string } | null;
        const restoredQuery = typeof parsed?.q === "string" ? parsed.q : "";
        setPendingQuery(restoredQuery);
        if (parsed?.allProducts) {
          setScope({});
          setSearchAllProducts(true);
          autoScopeAppliedRef.current = true;
          explicitAllProductsRef.current = false;
        } else if (parsed?.scope) {
          const next: Scope = {};
          if (parsed.scope.nav_root) next.nav_root = parsed.scope.nav_root;
          if (parsed.scope.nav_group && next.nav_root) next.nav_group = parsed.scope.nav_group;
          if (parsed.scope.nav_group_1 && next.nav_root && next.nav_group) next.nav_group_1 = parsed.scope.nav_group_1;
          if (parsed.scope.nav_group_2 && next.nav_root && next.nav_group && next.nav_group_1) {
            next.nav_group_2 = parsed.scope.nav_group_2;
          }
          setScope(next);
          setSearchAllProducts(false);
          autoScopeAppliedRef.current = true;
        } else if (restoredQuery) {
          setSearchAllProducts(false);
        }
      }
    } catch {
      // Ignore storage hydration errors.
    }
    hydrationRef.current = true;
    didHydrateRef.current = true;
  }, [open, storageKey, storageScope]);

  if (!open) return null;

  const breadcrumb = React.useMemo(() => {
    const crumbs: NavCrumb[] = [{ type: "all", label: "All products" }];
    if (scope.nav_root) {
      const label = labelLookups.root[scope.nav_root] ?? scope.nav_root;
      crumbs.push({ type: "nav_root", slug: scope.nav_root, label });
    }
    if (scope.nav_group && scope.nav_root) {
      const label = labelLookups.group[scope.nav_root]?.[scope.nav_group] ?? scope.nav_group;
      crumbs.push({ type: "nav_group", slug: scope.nav_group, label });
    }
    if (scope.nav_group_1 && scope.nav_root && scope.nav_group) {
      const label = labelLookups.group1[scope.nav_root]?.[scope.nav_group]?.[scope.nav_group_1] ?? scope.nav_group_1;
      crumbs.push({ type: "nav_group_1", slug: scope.nav_group_1, label });
    }
    if (scope.nav_group_2 && scope.nav_root && scope.nav_group && scope.nav_group_1) {
      const label =
        labelLookups.group2[scope.nav_root]?.[scope.nav_group]?.[scope.nav_group_1]?.[scope.nav_group_2] ??
        scope.nav_group_2;
      crumbs.push({ type: "nav_group_2", slug: scope.nav_group_2, label });
    }
    return crumbs;
  }, [labelLookups, scope.nav_group, scope.nav_group_1, scope.nav_group_2, scope.nav_root]);
  const hasScopeSelection = Boolean(scope.nav_root || scope.nav_group || scope.nav_group_1 || scope.nav_group_2);
  const scopeLabel = hasScopeSelection ? breadcrumb[breadcrumb.length - 1]?.label || null : null;
  const scopeChildren = React.useMemo(() => {
    if (!scope.nav_root) return sortOptions(rootOptions, browseSort, "root");
    if (scope.nav_root && !scope.nav_group)
      return sortOptions(groupOptionsByRoot.get(scope.nav_root) ?? [], browseSort, "group");
    if (scope.nav_root && scope.nav_group && !scope.nav_group_1) {
      return sortOptions(
        group1OptionsByPath.get(scope.nav_root)?.get(scope.nav_group) ?? [],
        browseSort,
        "group1",
      );
    }
    if (scope.nav_root && scope.nav_group && scope.nav_group_1 && !scope.nav_group_2) {
      return sortOptions(
        group2OptionsByPath.get(scope.nav_root)?.get(scope.nav_group)?.get(scope.nav_group_1) ?? [],
        browseSort,
        "group2",
      );
    }
    return [];
  }, [
    browseSort,
    group1OptionsByPath,
    group2OptionsByPath,
    groupOptionsByRoot,
    rootOptions,
    scope.nav_group,
    scope.nav_group_1,
    scope.nav_group_2,
    scope.nav_root,
  ]);
  const searchPlaceholder =
    !searchAllProducts && hasScopeSelection && scopeLabel
      ? `Search in ${scopeLabel}`
      : "Search all products (SKU or name)";
  const isSearching = query.trim().length > 0;
  const showSkus = isSearching || scopeChildren.length === 0;

  const flatResults = React.useMemo(() => {
    const useSelectionFilter = query === "" || !searchAllProducts;
    const effectiveSelection = useSelectionFilter ? scope : {};
    const scored = products
      .map((product) => {
        if (!matchesSelection(product, effectiveSelection)) return null;
        const score = scoreProduct(product, query);
        if (query && score === 0) return null;
        const brandSlug = normalizeNavValue(product.nav_root) || slugify("other");
        const brandLabel = (brandSlug && labelLookups.root[brandSlug]) || product.nav_root || "Other";
        return {
          product,
          score,
          brandSlug,
          brandLabel,
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
  }, [
    labelLookups.root,
    products,
    query,
    scope.nav_group,
    scope.nav_group_1,
    scope.nav_group_2,
    scope.nav_root,
    searchAllProducts,
  ]);

  React.useEffect(() => {
    setSelectedIndex(flatResults.length > 0 ? 0 : -1);
  }, [flatResults.length, query, searchAllProducts, scope.nav_root, scope.nav_group, scope.nav_group_1, scope.nav_group_2]);

  const selectedEntry = flatResults[selectedIndex] ?? flatResults[0] ?? null;
  const selectedSku = selectedEntry?.product.sku || "";
  const selectedTitleParts = selectedEntry ? splitTitleOnFirstDot(selectedEntry.product.name) : null;
  const selectedTitleHead = selectedEntry
    ? selectedTitleParts?.head || selectedEntry.product.name || selectedEntry.product.sku
    : "";
  const selectedTitleTail = selectedTitleParts?.tail ? selectedTitleParts.tail.trim() : "";

  React.useEffect(() => {
    if (selectedIndex < 0) return;
    const listEl = resultsListRef.current;
    if (!listEl) return;
    const activeRow = listEl.querySelector<HTMLElement>(`[data-result-index="${selectedIndex}"]`);
    if (!activeRow) return;
    activeRow.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatResults.length === 0) return;
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(flatResults.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatResults.length === 0) return;
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
        const highlighted = flatResults[selectedIndex];
        if (highlighted) setPendingQuery(highlighted.product.sku);
      }
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
  const currencyCode = currency || MONEY_FALLBACK_CURRENCY;
  const updateScope = React.useCallback((next: Scope) => {
    const normalized: Scope = {};
    if (next.nav_root) normalized.nav_root = next.nav_root;
    if (next.nav_group && normalized.nav_root) normalized.nav_group = next.nav_group;
    if (next.nav_group_1 && normalized.nav_root && normalized.nav_group) normalized.nav_group_1 = next.nav_group_1;
    if (next.nav_group_2 && normalized.nav_root && normalized.nav_group && normalized.nav_group_1) {
      normalized.nav_group_2 = next.nav_group_2;
    }
    setScope(normalized);
    setSearchAllProducts(false);
  }, []);
  React.useEffect(() => {
    if (!open || !didHydrateRef.current) return;
    if (typeof window === "undefined") return;
    try {
      const isScopeEmpty = !scope.nav_root && !scope.nav_group && !scope.nav_group_1 && !scope.nav_group_2;
      const payloadBase = { q: pendingQuery };
      if (searchAllProducts) {
        if (explicitAllProductsRef.current) {
          window.sessionStorage.setItem(storageKey, JSON.stringify({ ...payloadBase, allProducts: true }));
          explicitAllProductsRef.current = false;
        }
        return;
      }
      if (isScopeEmpty) {
        if (explicitAllProductsRef.current) {
          window.sessionStorage.setItem(storageKey, JSON.stringify({ ...payloadBase, allProducts: true }));
          explicitAllProductsRef.current = false;
        }
        window.sessionStorage.setItem(storageKey, JSON.stringify(payloadBase));
        return;
      }
      window.sessionStorage.setItem(storageKey, JSON.stringify({ ...payloadBase, scope }));
    } catch {
      // Ignore storage persistence errors.
    }
  }, [
    open,
    scope.nav_group,
    scope.nav_group_1,
    scope.nav_group_2,
    scope.nav_root,
    searchAllProducts,
    pendingQuery,
    storageKey,
  ]);
  React.useEffect(() => {
    const isScopeEmpty = !scope.nav_root && !scope.nav_group && !scope.nav_group_1 && !scope.nav_group_2;
    if (isScopeEmpty && rootOptions.length === 1 && !autoScopeAppliedRef.current) {
      autoScopeAppliedRef.current = true;
      const soleRoot = rootOptions[0];
      if (soleRoot) updateScope({ nav_root: soleRoot.slug });
    }
  }, [rootOptions, scope.nav_group, scope.nav_group_1, scope.nav_group_2, scope.nav_root, updateScope]);
  const handleCrumbClick = (crumb: NavCrumb) => {
    if (crumb.type === "all") {
      explicitAllProductsRef.current = true;
      updateScope({});
      return;
    }
    if (crumb.type === "nav_root") {
      updateScope({ nav_root: crumb.slug });
      return;
    }
    if (crumb.type === "nav_group") {
      updateScope({ nav_root: scope.nav_root, nav_group: crumb.slug });
      return;
    }
    if (crumb.type === "nav_group_1") {
      updateScope({ nav_root: scope.nav_root, nav_group: scope.nav_group, nav_group_1: crumb.slug });
      return;
    }
    if (crumb.type === "nav_group_2") {
      updateScope({
        nav_root: scope.nav_root,
        nav_group: scope.nav_group,
        nav_group_1: scope.nav_group_1,
        nav_group_2: crumb.slug,
      });
    }
  };
  const handleBack = () => {
    if (scope.nav_group_2) {
      updateScope({ nav_root: scope.nav_root, nav_group: scope.nav_group, nav_group_1: scope.nav_group_1 });
    } else if (scope.nav_group_1) {
      updateScope({ nav_root: scope.nav_root, nav_group: scope.nav_group });
    } else if (scope.nav_group) {
      updateScope({ nav_root: scope.nav_root });
    } else if (scope.nav_root) {
      updateScope({});
    }
  };

  const handleDirectAdd = async () => {
    let entry = selectedEntry;
    if (!entry && pendingQuery.trim()) {
      const match = flatResults.find(
        (res) => res.product.sku.toLowerCase() === pendingQuery.trim().toLowerCase(),
      );
      if (match) {
        entry = match;
        const matchIndex = flatResults.findIndex((res) => res.product.sku === match.product.sku);
        if (matchIndex >= 0) setSelectedIndex(matchIndex);
      }
    }
    if (!entry) return;
    const product = entry.product;
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
    const price = coerceAmount(product.price) ?? 0;
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

  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <div className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid items-start gap-3 md:grid-cols-[minmax(320px,1fr)_minmax(400px,1fr)]">
          <div className="space-y-2 self-start">
            <div className="h-full rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <div className="flex h-full flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <label className="text-xs font-medium text-neutral-700" htmlFor="catalogue-search">
                      Search products
                    </label>
                    <span className="text-xs text-neutral-500">Searches within the selected category.</span>
                  </div>
                  {onClose ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      Close
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="catalogue-search"
                    ref={searchRef}
                    value={pendingQuery}
                    onChange={(e) => {
                      const next = e.currentTarget.value;
                      setPendingQuery(next);
                      persistQueryNow(next);
                    }}
                    onKeyDown={onSearchKeyDown}
                    placeholder={searchPlaceholder}
                    className="w-full max-w-lg flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
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
                    className="w-20 rounded-md border border-neutral-300 px-2 py-2 text-sm text-neutral-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                  />
                  <button
                    type="button"
                    onClick={handleDirectAdd}
                    className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800 min-w-[140px]"
                  >
                    {mode === "quote" ? "Add to quote" : "Add to cart"}
                  </button>
                  {hasScopeSelection ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-neutral-700 underline-offset-4 hover:underline"
                      onClick={() =>
                        setSearchAllProducts((prev) => {
                          const next = !prev;
                          if (next) explicitAllProductsRef.current = true;
                          return next;
                        })
                      }
                    >
                      {searchAllProducts ? "Search in this section" : "All products"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="h-full self-start rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <div className="flex h-full flex-col justify-center gap-1">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1 text-sm font-semibold text-neutral-900 truncate">
                  {selectedEntry ? `${selectedSku} — ${selectedTitleHead}` : "Select an item to view details"}
                </div>
                <div className="min-w-[90px] text-right text-sm font-semibold text-neutral-900">
                  {selectedEntry ? formatPrice(selectedEntry.product.price, currencyCode) : "—"}
                </div>
              </div>
              <div className="min-w-0 text-xs text-neutral-600 truncate">
                {selectedEntry ? selectedTitleTail || "" : ""}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-lg border border-neutral-200 mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 text-xs md:px-4 md:py-2.5">
            <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
              {hasScopeSelection ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-md border border-neutral-200 px-2 py-1 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
                >
                  Back
                </button>
              ) : null}
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-900">
                <button
                  type="button"
                  className="font-semibold hover:underline"
                  onClick={() => {
                    explicitAllProductsRef.current = true;
                    updateScope({});
                  }}
                >
                  Products
                </button>
                {scope.nav_root ? (
                  <>
                    <span className="mx-1.5 text-neutral-500">/</span>
                    <button
                      type="button"
                      className={`hover:underline ${
                        scope.nav_root && !scope.nav_group ? "font-semibold" : "font-medium"
                      }`}
                      onClick={() => updateScope({ nav_root: scope.nav_root })}
                    >
                      {labelLookups.root[scope.nav_root] ?? scope.nav_root}
                    </button>
                  </>
                ) : null}
                {scope.nav_root && scope.nav_group ? (
                  <>
                    <span className="mx-1.5 text-neutral-500">/</span>
                    <button
                      type="button"
                      className={`hover:underline ${
                        scope.nav_root && scope.nav_group && !scope.nav_group_1 ? "font-semibold" : "font-medium"
                      }`}
                      onClick={() => updateScope({ nav_root: scope.nav_root, nav_group: scope.nav_group })}
                    >
                      {labelLookups.group[scope.nav_root]?.[scope.nav_group] ?? scope.nav_group}
                    </button>
                  </>
                ) : null}
                {scope.nav_root && scope.nav_group && scope.nav_group_1 ? (
                  <>
                    <span className="mx-1.5 text-neutral-500">/</span>
                    <button
                      type="button"
                      className={`hover:underline ${
                        scope.nav_root && scope.nav_group && scope.nav_group_1 && !scope.nav_group_2
                          ? "font-semibold"
                          : "font-medium"
                      }`}
                      onClick={() =>
                        updateScope({
                          nav_root: scope.nav_root,
                          nav_group: scope.nav_group,
                          nav_group_1: scope.nav_group_1,
                        })
                      }
                    >
                      {labelLookups.group1[scope.nav_root]?.[scope.nav_group]?.[scope.nav_group_1] ??
                        scope.nav_group_1}
                    </button>
                  </>
                ) : null}
                {scope.nav_root && scope.nav_group && scope.nav_group_1 && scope.nav_group_2 ? (
                  <>
                    <span className="mx-1.5 text-neutral-500">/</span>
                    <span className="truncate font-semibold">
                      {labelLookups.group2[scope.nav_root]?.[scope.nav_group]?.[scope.nav_group_1]?.[
                        scope.nav_group_2
                      ] ?? scope.nav_group_2}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-700">
              <span className="font-semibold">Sort:</span>
              <select
                value={browseSort}
                onChange={(e) => setBrowseSort(e.currentTarget.value as BrowseSort)}
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-800"
              >
                <option value="popular">Most popular</option>
                <option value="asc">A–Z</option>
                <option value="desc">Z–A</option>
              </select>
            </div>
          </div>
          {showSkus ? (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-neutral-800 md:px-4 md:py-2.5">
                Results ({flatResults.length})
              </div>
              <div
                ref={resultsListRef}
                className="divide-y divide-neutral-200 overflow-y-auto max-h-[420px] md:max-h-[440px]"
              >
                {flatResults.map((entry, idx) => {
                  const isSelected = idx === selectedIndex;
                  const availability = getAvailabilityState({
                    merchandiseId: entry.product.merchandiseId,
                    requiresQuote: entry.product.requires_quote,
                    discontinued: false,
                  });
                  const canAdd = mode === "quote" ? availability !== "discontinued" : canAddToCart(availability);
                  const { head, tail } = splitTitleOnFirstDot(entry.product.name);
                  const titleHead = head || entry.product.name || entry.product.sku;
                  const titleLine = titleHead ? `${entry.product.sku} — ${titleHead}` : entry.product.sku;
                  const tailText = tail ? tail.trim() : "";
                  const priceLabel = formatPrice(entry.product.price, currencyCode);
                  return (
                    <button
                      key={entry.product.sku}
                      type="button"
                      data-result-index={idx}
                      onClick={() => {
                        setSelectedIndex(idx);
                        setQuantity("1");
                        requestAnimationFrame(() => {
                          qtyRef.current?.focus();
                          qtyRef.current?.select();
                        });
                      }}
                      className={`grid w-full grid-cols-[140px_1fr_110px] items-start gap-x-4 gap-y-1 px-3 py-2 text-left text-sm transition sm:grid-cols-[160px_1fr_120px] md:grid-cols-[180px_1fr_130px] ${
                        isSelected ? "border-l-4 border-l-neutral-900 bg-neutral-50" : "hover:bg-neutral-50"
                      }`}
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate tabular-nums text-sm font-semibold text-neutral-900">
                          {entry.product.sku}
                        </span>
                        <span className="text-[11px] font-medium text-neutral-600">
                          {canAdd ? "Ready" : "Unavailable"}
                        </span>
                      </div>
                      <div className="min-w-0 flex flex-col gap-1">
                        <div className="truncate text-sm font-semibold text-neutral-900">{titleLine}</div>
                        {tailText ? (
                          <p className="line-clamp-2 text-xs leading-relaxed text-neutral-600">{tailText}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end justify-start gap-0.5 text-sm font-semibold text-neutral-900">
                        <span className="text-right">{priceLabel}</span>
                        {availability === "quote_only" ? (
                          <span className="text-[11px] font-medium text-neutral-600">Quote only</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
                {flatResults.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-neutral-600">No matches found.</p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="px-3 py-3">
              <div className="space-y-2">
                {sortOptions(rootOptions, browseSort, "root").map((root) => {
                  const isRootActive = scope.nav_root === root.slug;
                  const groups = sortOptions(groupOptionsByRoot.get(root.slug) || [], browseSort, "group");
                  const showGroups = isRootActive && groups.length > 0;
                  return (
                    <div key={root.slug} className="space-y-1">
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs transition ${
                          isRootActive
                            ? "bg-neutral-100 border-l-4 border-black font-semibold text-black"
                            : "border-neutral-200 text-foreground hover:border-neutral-300 hover:bg-neutral-50"
                        }`}
                        onClick={() => updateScope({ nav_root: root.slug })}
                      >
                        <span className="truncate">{root.label}</span>
                        {showGroups ? (
                          <span className="inline-block h-4 w-4 transition-transform rotate-180 text-black">^</span>
                        ) : (
                          <span className="inline-block h-4 w-4 transition-transform text-muted-foreground">+</span>
                        )}
                      </button>
                      {showGroups ? (
                        <div className="pl-3">
                          <div className="space-y-1">
                            {groups.map((group) => {
                              const isGroupActive = scope.nav_group === group.slug;
                              const subgroups = sortOptions(
                                group1OptionsByPath.get(root.slug)?.get(group.slug) || [],
                                browseSort,
                                "group1",
                              );
                              const showSubgroups = isGroupActive && subgroups.length > 0;
                              return (
                                <div key={group.slug} className="space-y-1">
                                  <button
                                    type="button"
                                    className={`flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-xs transition ${
                                      isGroupActive
                                        ? "bg-neutral-100 border-l-4 border-black font-semibold text-black"
                                        : "border-neutral-200 text-foreground hover:border-neutral-300 hover:bg-neutral-50"
                                    }`}
                                    onClick={() => updateScope({ nav_root: root.slug, nav_group: group.slug })}
                                  >
                                    <span className="truncate">{group.label}</span>
                                    {showSubgroups ? (
                                      <span className="inline-block h-4 w-4 transition-transform rotate-180 text-black">
                                        ^
                                      </span>
                                    ) : (
                                      subgroups.length > 0 && (
                                        <span className="inline-block h-4 w-4 transition-transform text-muted-foreground">
                                          +
                                        </span>
                                      )
                                    )}
                                  </button>
                                  {showSubgroups ? (
                                    <div className="pl-3">
                                      <div className="space-y-1">
                                        {subgroups.map((item) => {
                                          const isSubActive = scope.nav_group_1 === item.slug;
                                          const group2 = sortOptions(
                                            group2OptionsByPath.get(root.slug)?.get(group.slug)?.get(item.slug) || [],
                                            browseSort,
                                            "group2",
                                          );
                                          const showGroup2 = isSubActive && group2.length > 0;
                                          return (
                                            <div key={item.slug} className="space-y-1">
                                              <button
                                                type="button"
                                                className={`flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-xs transition ${
                                                  isSubActive
                                                    ? "bg-neutral-100 border-l-4 border-black font-semibold text-black"
                                                    : "border-neutral-200 text-foreground hover:border-neutral-300 hover:bg-neutral-50"
                                                }`}
                                                onClick={() =>
                                                  updateScope({
                                                    nav_root: root.slug,
                                                    nav_group: group.slug,
                                                    nav_group_1: item.slug,
                                                  })
                                                }
                                              >
                                                <span className="truncate">{item.label}</span>
                                                {showGroup2 ? (
                                                  <span className="inline-block h-4 w-4 transition-transform rotate-180 text-black">
                                                    ^
                                                  </span>
                                                ) : (
                                                  group2.length > 0 && (
                                                    <span className="inline-block h-4 w-4 transition-transform text-muted-foreground">
                                                      +
                                                    </span>
                                                  )
                                                )}
                                              </button>
                                              {showGroup2 ? (
                                                <div className="pl-3">
                                                  <div className="flex flex-wrap gap-2">
                                                    {group2.map((leaf) => {
                                                      const isLeafActive = scope.nav_group_2 === leaf.slug;
                                                      return (
                                                        <button
                                                          key={leaf.slug}
                                                          type="button"
                                                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                                                            isLeafActive
                                                              ? "border-neutral-900 bg-neutral-900 text-white"
                                                              : "border-neutral-200 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50"
                                                          }`}
                                                          onClick={() =>
                                                            updateScope({
                                                              nav_root: root.slug,
                                                              nav_group: group.slug,
                                                              nav_group_1: item.slug,
                                                              nav_group_2: leaf.slug,
                                                            })
                                                          }
                                                        >
                                                          {leaf.label}
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
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
