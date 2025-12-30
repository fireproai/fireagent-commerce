import Link from "next/link";

import { MobileFilters } from "../_components/MobileFilters";
import { ProductTile } from "../_components/ProductTile";
import {
  PIM_NAV_PATH,
  PIM_PRODUCTS_PATH,
  PimNavRoot,
  getPimNav,
  getPimProducts,
} from "lib/pim/source";
import { SidebarFilterList } from "../_components/SidebarFilterList";
import { getMerchandiseIdForSku } from "lib/shopifyVariantMap";
import { slugify } from "lib/plytix/slug";

async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

function normalizeLabel(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function groupPriority(label: string) {
  const norm = normalizeLabel(label);
  if (norm.includes("panel")) return 0;
  if (norm.includes("mcp") || norm.includes("call")) return 1;
  if (norm.includes("sensor") || norm.includes("squad") || norm.includes("detector") || norm.includes("detection"))
    return 2;
  if (norm.startsWith("s3")) return 3;
  if (norm.includes("interface")) return 4;
  if (norm.includes("winmag")) return 5;
  return 100;
}

function sortNavGroups<T extends { label: string }>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    const pa = groupPriority(a.label);
    const pb = groupPriority(b.label);
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label);
  });
}

export const revalidate = 600;

type BreadcrumbProps = { rootEntry?: PimNavRoot | null };

const Breadcrumb = ({ rootEntry }: BreadcrumbProps) => (
  <div className="space-y-1 text-sm text-neutral-500">
    <Link href="/products" className="inline-flex items-center gap-1 text-neutral-600 hover:underline">
      <span aria-hidden="true">{"<-"}</span>
      Back
    </Link>
    <div>
      <Link href="/products" className="hover:underline">
        Products
      </Link>
      {rootEntry ? (
        <>
          {" / "}
          <span className="text-neutral-900">{rootEntry.label}</span>
        </>
      ) : (
        <>
          {" / "}
          <span className="text-neutral-700">Category not found</span>
        </>
      )}
    </div>
  </div>
);

export default async function ProductsByRootPage(props: { params: any }) {
  const params = await resolveParams<{ root?: string }>(props.params);
  const { tree, slug_map } = await getPimNav();
  const products = await getPimProducts();
  const rootSlug = params.root ?? "";

  const rootLabel = rootSlug
    ? slug_map.lookup.rootBySlug[rootSlug] ?? tree.find((root) => root.slug === rootSlug)?.label ?? null
    : null;

  const rootEntry: PimNavRoot | undefined = rootLabel
    ? tree.find((root) => root.label === rootLabel || root.slug === rootSlug)
    : undefined;

  if (!rootEntry) {
    return (
      <section className="space-y-6">
        <Breadcrumb rootEntry={null} />
        <div className="rounded-xl border border-neutral-200 bg-neutral-100/60 p-4">
          <h1 className="text-2xl font-semibold text-neutral-900">Category not found</h1>
          <p className="mt-1 text-sm text-neutral-600">
            The requested category does not exist or is unavailable.
          </p>
        </div>
      </section>
    );
  }

  const filteredProducts = rootEntry ? products.filter((product) => product.nav_root === rootEntry.label) : [];

  const groupSlugLookup = slug_map.lookup.groupBySlug[rootEntry?.slug ?? ""] || {};
  const labelToSlug = new Map<string, string>();
  Object.entries(groupSlugLookup).forEach(([slug, label]) => {
    labelToSlug.set(label, slug);
  });

  const groupCounts = new Map<string, { count: number }>();
  const subGroupCounts = new Map<string, Map<string, number>>();

  filteredProducts.forEach((product) => {
    const groupLabel = product.nav_group?.trim();
    if (!groupLabel) return;
    const groupKey = groupLabel;
    groupCounts.set(groupKey, { count: (groupCounts.get(groupKey)?.count || 0) + 1 });

    const subLabel = product.nav_group_1?.trim();
    if (subLabel) {
      const subMap = subGroupCounts.get(groupKey) || new Map<string, number>();
      subMap.set(subLabel, (subMap.get(subLabel) || 0) + 1);
      subGroupCounts.set(groupKey, subMap);
    }
  });

  const groupedFacets = sortNavGroups(
    Array.from(groupCounts.entries()).map(([label, meta]) => ({
      label,
      count: meta.count,
      slug: labelToSlug.get(label) ?? slugify(label),
    })),
  );

  if (process.env.NODE_ENV !== "production") {
    // Dev-only diagnostic to confirm facet source data
    const sampleRows = filteredProducts.slice(0, 3).map((p) => ({
      nav_group: p.nav_group,
      nav_group_1: p.nav_group_1,
    }));
    // eslint-disable-next-line no-console
    console.log("[facets]/products/[root]", {
      root: rootEntry?.label,
      navPath: PIM_NAV_PATH,
      productsPath: PIM_PRODUCTS_PATH,
      sampleRows,
      groupedFacets,
      subGroups: Array.from(subGroupCounts.entries()).map(([group, subs]) => ({
        group,
        subs: Array.from(subs.entries()),
      })),
    });
  }

  const isDev = process.env.NODE_ENV !== "production";
  const showDiagnostics = isDev && process.env.NEXT_PUBLIC_SHOW_NAV_DIAGNOSTICS === "1";
  const isResolved = Boolean(rootEntry);

  const ProductGrid = () => (
    <div className="space-y-4">
      {filteredProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-600">
          No SKUs available for this category.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductTile
              key={product.sku}
              product={{ ...product, merchandiseId: getMerchandiseIdForSku(product.sku) }}
            />
          ))}
        </div>
      )}
    </div>
  );

  const filtersPanel = rootEntry ? (
    <SidebarFilterList
      variant="plain"
      sections={[
        {
          title: "Groups",
          items: groupedFacets.map((group) => ({
            label: group.label,
            slug: group.slug,
            href: `/products/${rootEntry.slug}/${group.slug}`,
            count: group.count,
            selected: false,
          })),
        },
      ]}
      backHrefs={[undefined]}
    />
  ) : null;

  const Diagnostics = () =>
    showDiagnostics ? (
      <pre className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-700">
        {JSON.stringify(
          {
            params,
            navPath: PIM_NAV_PATH,
            rootSlug,
            rootLabel,
            resolved: Boolean(rootEntry),
            treeRoots: tree.map((root) => root.slug),
            lookupRoot: slug_map.lookup.rootBySlug[rootSlug],
          },
          null,
          2,
        )}
      </pre>
    ) : null;

  if (!isResolved) {
    return (
      <section className="space-y-4">
        {showDiagnostics ? (
          <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-4 text-xs text-neutral-800">
            <div className="mb-2 font-semibold">Navigation resolution diagnostics</div>
            <pre className="overflow-auto whitespace-pre-wrap">
              {JSON.stringify(
                {
                  params,
                  navPath: PIM_NAV_PATH,
                  rootSlug,
                  lookup: slug_map.lookup,
                  treeRoots: tree.map((r) => ({ label: r.label, slug: r.slug })),
                },
                null,
                2,
              )}
            </pre>
          </div>
        ) : (
          <p className="rounded-lg border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-700">
            No matching category found.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Diagnostics />

      <Breadcrumb rootEntry={rootEntry} />
      <div className="rounded-xl border border-neutral-200 bg-neutral-100/60 p-4">
        <h1 className="text-3xl font-bold text-neutral-900">{rootEntry.label}</h1>
        <p className="mt-1 text-sm text-neutral-600">Browse {rootEntry.label} products and parts.</p>
        <div className="mt-3 flex items-center justify-between text-sm text-neutral-700">
          <span>
            {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"}
          </span>
          <Link href="/products" className="font-medium hover:text-neutral-900">
            All products
          </Link>
        </div>
      </div>

      <div
        className="w-full grid gap-6 items-start grid-cols-1 lg:grid-cols-12"
        data-testid="category-grid-wrapper"
      >
        <aside
          className="self-start md:sticky md:top-24 lg:col-span-3 xl:col-span-3 w-full max-w-[320px] xl:max-w-[360px]"
          data-testid="sidebar"
        >
          <div className="max-h-[calc(100vh-8rem)] overflow-auto rounded-lg border border-neutral-200 bg-white">
            {filtersPanel}
          </div>
        </aside>

        <main className="min-w-0 w-full lg:col-span-9 xl:col-span-9" data-testid="main">
          <div className="sm:hidden">
            {filtersPanel ? <MobileFilters title="Filters">{filtersPanel}</MobileFilters> : null}
          </div>

          <ProductGrid />
        </main>
      </div>
    </section>
  );
}
