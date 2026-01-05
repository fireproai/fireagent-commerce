import Link from "next/link";

import { MobileFilters } from "../../../../../_components/MobileFilters";
import { SidebarFilterList } from "../../../../../_components/SidebarFilterList";
import { ProductTile } from "../../../../../_components/ProductTile";
import {
  PIM_NAV_PATH,
  PimNavGroup,
  PimNavItem,
  PimNavRoot,
  getPimNav,
  getPimProducts,
} from "lib/pim/source";
import { resolveMerchandiseIds } from "lib/shopify/skuResolver";
import { filterProductsForNode } from "../../../../../../products/_components/product-filtering";

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
  if (norm.includes("mcp") || norm.includes("manualcall") || norm.includes("callpoint")) return 1;
  if (norm.includes("sensor") || norm.includes("squad") || norm.includes("detector") || norm.includes("detection"))
    return 2;
  if (norm.startsWith("s3")) return 3;
  if (norm.includes("interface") || norm.includes("module") || norm.includes("gateway")) return 4;
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

export default async function ProductsByGroup3Page(props: { params: any }) {
  const params = await resolveParams<{
    root?: string;
    group?: string;
    group1?: string;
    group2?: string;
    group3?: string;
  }>(props.params);
  const { tree, slug_map } = await getPimNav();
  const products = await getPimProducts();
  const rootSlug = params.root ?? "";
  const groupSlug = params.group ?? "";
  const group1Slug = params.group1 ?? "";
  const group2Slug = params.group2 ?? "";
  const group3Slug = params.group3 ?? "";

  const rootLabel = rootSlug
    ? slug_map.lookup.rootBySlug[rootSlug] ?? tree.find((root) => root.slug === rootSlug)?.label ?? null
    : null;

  const rootEntry: PimNavRoot | undefined = rootLabel
    ? tree.find((root) => root.label === rootLabel || root.slug === rootSlug)
    : undefined;

  const groupLabel = rootEntry
    ? slug_map.lookup.groupBySlug[rootEntry.slug]?.[groupSlug] ??
      rootEntry.groups.find((group) => group.slug === groupSlug)?.label ??
      null
    : null;

  const groupEntry: PimNavGroup | undefined = rootEntry
    ? rootEntry.groups.find((group) => group.label === groupLabel || group.slug === groupSlug)
    : undefined;

  const group1Label = groupEntry
    ? slug_map.lookup.group1BySlug[rootEntry!.slug]?.[groupEntry.slug]?.[group1Slug] ??
      groupEntry.items.find((item) => item.slug === group1Slug)?.label ??
      null
    : null;

  const group1Entry: PimNavItem | undefined = groupEntry
    ? groupEntry.items.find((item) => item.label === group1Label || item.slug === group1Slug)
    : undefined;

  const group2Label = group1Entry
    ? slug_map.lookup.group2BySlug[rootEntry!.slug]?.[groupEntry!.slug]?.[group1Entry.slug]?.[group2Slug] ??
      group1Entry.items.find((item) => item.slug === group2Slug)?.label ??
      null
    : null;

  const group2Entry: PimNavItem | undefined = group1Entry
    ? group1Entry.items.find((item) => item.label === group2Label || item.slug === group2Slug)
    : undefined;

  const group3Label = group2Entry
    ? slug_map.lookup.group3BySlug[rootEntry!.slug]?.[groupEntry!.slug]?.[group1Entry!.slug]?.[group2Entry.slug]?.[group3Slug] ??
      group2Entry.items.find((item) => item.slug === group3Slug)?.label ??
      null
    : null;

  const group3Entry: PimNavItem | undefined = group2Entry
    ? group2Entry.items.find((item) => item.label === group3Label || item.slug === group3Slug)
    : undefined;

  const sortedGroups = rootEntry
    ? sortNavGroups(
        rootEntry.groups.map((group) => ({
          ...group,
          skuCount: filterProductsForNode(
            products,
            2,
            { rootLabel: rootEntry.label, groupLabel: group.label },
            false,
          ).length,
        })),
      )
    : [];

  const subGroupFacets =
    rootEntry && groupEntry
      ? groupEntry.items.map((item) => ({
          label: item.label,
          slug: item.slug,
          count: filterProductsForNode(
            products,
            3,
            {
              rootLabel: rootEntry.label,
              groupLabel: groupEntry.label,
              group1Label: item.label,
            },
            false,
          ).length,
        }))
      : [];
  const subGroupCountBySlug = new Map(subGroupFacets.map((facet) => [facet.slug, facet.count]));

  const rangeFacets =
    rootEntry && groupEntry && group1Entry
      ? group1Entry.items.map((item2) => ({
          label: item2.label,
          slug: item2.slug,
          count: filterProductsForNode(
            products,
            4,
            {
              rootLabel: rootEntry.label,
              groupLabel: groupEntry.label,
              group1Label: group1Entry.label,
              group2Label: item2.label,
            },
            false,
          ).length,
        }))
      : [];
  const rangeCountBySlug = new Map(rangeFacets.map((facet) => [facet.slug, facet.count]));

  const subRangeFacets =
    rootEntry && groupEntry && group1Entry && group2Entry
      ? group2Entry.items.map((item3) => ({
          label: item3.label,
          slug: item3.slug,
          count: filterProductsForNode(
            products,
            5,
            {
              rootLabel: rootEntry.label,
              groupLabel: groupEntry.label,
              group1Label: group1Entry.label,
              group2Label: group2Entry.label,
              group3Label: item3.label,
            },
            false,
          ).length,
        }))
      : [];
  const subRangeCountBySlug = new Map(subRangeFacets.map((facet) => [facet.slug, facet.count]));

  const filteredProducts =
    rootEntry && groupEntry && group1Entry && group2Entry && group3Entry
      ? filterProductsForNode(
          products,
          5,
          {
            rootLabel: rootEntry.label,
            groupLabel: groupEntry.label,
            group1Label: group1Entry.label,
            group2Label: group2Entry.label,
            group3Label: group3Entry.label,
          },
          false,
        )
      : [];

  const merchandiseMap = await resolveMerchandiseIds(filteredProducts.map((p) => p.sku));

  const isDev = process.env.NODE_ENV !== "production";
  const showDiagnostics = isDev && process.env.NEXT_PUBLIC_SHOW_NAV_DIAGNOSTICS === "1";
  const isResolved = Boolean(rootEntry && groupEntry && group1Entry && group2Entry && group3Entry);

  const Breadcrumb = () => (
    <div className="space-y-1 text-sm text-neutral-500">
      <Link
        href={`/products/${rootSlug}/${groupSlug}/${group1Slug}/${group2Slug}`}
        className="inline-flex items-center gap-1 text-neutral-600 hover:underline"
      >
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
            <Link href={`/products/${rootEntry.slug}`} className="hover:underline">
              {rootEntry.label}
            </Link>
          </>
        ) : null}
        {groupEntry ? (
          <>
            {" / "}
            <Link href={`/products/${rootEntry?.slug}/${groupEntry.slug}`} className="hover:underline">
              {groupEntry.label}
            </Link>
          </>
        ) : null}
        {group1Entry ? (
          <>
            {" / "}
            <Link
              href={`/products/${rootEntry?.slug}/${groupEntry?.slug}/${group1Entry.slug}`}
              className="hover:underline"
            >
              {group1Entry.label}
            </Link>
          </>
        ) : null}
        {group2Entry ? (
          <>
            {" / "}
            <Link
              href={`/products/${rootEntry?.slug}/${groupEntry?.slug}/${group1Entry?.slug}/${group2Entry.slug}`}
              className="hover:underline"
            >
              {group2Entry.label}
            </Link>
          </>
        ) : null}
        {group3Entry ? (
          <>
            {" / "}
            <span className="text-neutral-900">{group3Entry.label}</span>
          </>
        ) : null}
      </div>
    </div>
  );

  const filtersPanel =
    rootEntry && groupEntry ? (
      <SidebarFilterList
        variant="plain"
        sections={[
          {
            title: "Groups",
            items: sortedGroups.map((group) => ({
              label: group.label,
              slug: group.slug,
              href: `/products/${rootEntry.slug}/${group.slug}`,
              count: group.skuCount,
              selected: group.slug === groupEntry.slug,
            })),
          },
          ...(groupEntry.items.length
            ? [
                {
                  title: "Sub-groups",
                  items: groupEntry.items.map((item) => ({
                    label: item.label,
                    slug: item.slug,
                    href: `/products/${rootEntry.slug}/${groupEntry.slug}/${item.slug}`,
                    count: subGroupCountBySlug.get(item.slug) ?? 0,
                    selected: item.slug === (group1Entry?.slug ?? ""),
                  })),
                },
              ]
            : []),
          ...(group1Entry?.items?.length
            ? [
                {
                  title: "Ranges",
                  items: group1Entry.items.map((item2) => ({
                    label: item2.label,
                    slug: item2.slug,
                    href: `/products/${rootEntry.slug}/${groupEntry.slug}/${group1Entry.slug}/${item2.slug}`,
                    count: rangeCountBySlug.get(item2.slug) ?? 0,
                    selected: item2.slug === (group2Entry?.slug ?? ""),
                  })),
                },
              ]
            : []),
          ...(group2Entry?.items?.length
            ? [
                {
                  title: "Sub-ranges",
                  items: group2Entry.items.map((item3) => ({
                    label: item3.label,
                    slug: item3.slug,
                    href: `/products/${rootEntry.slug}/${groupEntry.slug}/${group1Entry!.slug}/${group2Entry.slug}/${item3.slug}`,
                    count: subRangeCountBySlug.get(item3.slug) ?? 0,
                    selected: item3.slug === (group3Entry?.slug ?? ""),
                  })),
                },
              ]
            : []),
        ]}
        backHrefs={[
          undefined,
          `/products/${rootEntry.slug}`,
          `/products/${rootEntry.slug}/${groupEntry.slug}`,
          `/products/${rootEntry.slug}/${groupEntry.slug}/${group1Entry?.slug}`,
          `/products/${rootEntry.slug}/${groupEntry.slug}/${group1Entry?.slug}/${group2Entry?.slug}`,
        ]}
        currentLevel={group3Entry ? 3 : group2Entry ? 3 : group1Entry ? 2 : groupEntry ? 1 : 0}
      />
    ) : null;

  const ProductGrid = () => (
    <div className="space-y-4">
      {filteredProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-600">
          No SKUs available for this selection.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductTile
              key={product.sku}
              product={{ ...product, merchandiseId: merchandiseMap[product.sku] ?? null }}
            />
          ))}
        </div>
      )}
    </div>
  );

  const Diagnostics = () =>
    showDiagnostics ? (
      <pre className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-700">
        {JSON.stringify(
          {
            params,
            navPath: PIM_NAV_PATH,
            rootSlug,
            groupSlug,
            group1Slug,
            group2Slug,
            group3Slug,
            resolved: isResolved,
            lookup: {
              root: slug_map.lookup.rootBySlug[rootSlug],
              group: slug_map.lookup.groupBySlug[rootSlug]?.[groupSlug],
              group1: slug_map.lookup.group1BySlug[rootSlug]?.[groupSlug]?.[group1Slug],
              group2: slug_map.lookup.group2BySlug[rootSlug]?.[groupSlug]?.[group1Slug]?.[group2Slug],
              group3:
                slug_map.lookup.group3BySlug[rootSlug]?.[groupSlug]?.[group1Slug]?.[group2Slug]?.[group3Slug],
            },
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
                  groupSlug,
                  group1Slug,
                  group2Slug,
                  group3Slug,
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

      <Breadcrumb />
      <div className="rounded-xl border border-neutral-200 bg-neutral-100/60 p-4">
        <h1 className="text-3xl font-bold text-neutral-900">{group3Entry!.label}</h1>
        <p className="mt-1 text-sm text-neutral-600">Browse {group3Entry!.label} products and parts.</p>
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
