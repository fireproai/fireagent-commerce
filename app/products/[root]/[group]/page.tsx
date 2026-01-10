import Link from "next/link";

import { MobileFilters } from "../../_components/MobileFilters";
import { SidebarFilterList } from "../../_components/SidebarFilterList";
import {
  PIM_NAV_PATH,
  PimNavGroup,
  PimNavRoot,
  getPimNav,
  getPimProducts,
} from "lib/pim/source";
import { ProductTile } from "../../_components/ProductTile";
import { resolveMerchandiseIds } from "lib/shopify/skuResolver";
import { filterProductsForNode } from "../../_components/product-filtering";
import { getStoreCurrency } from "lib/shopify/storeCurrency";

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

export default async function ProductsByGroupPage(props: { params: any; searchParams?: any }) {
  const params = await resolveParams<{ root?: string; group?: string }>(props.params);
  const searchParams = await resolveParams<Record<string, string>>(props.searchParams ?? {});
  const { tree, slug_map } = await getPimNav();
  const products = await getPimProducts();
  const storeCurrency = await getStoreCurrency();
  const rootSlug = params.root ?? "";
  const groupSlug = params.group ?? "";
  const showAll = (searchParams?.show || "").toLowerCase() === "all";

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

  const filteredProducts =
    rootEntry && groupEntry
      ? filterProductsForNode(
          products,
          2,
          { rootLabel: rootEntry.label, groupLabel: groupEntry.label },
          showAll,
        )
      : [];

  const merchandiseMap = await resolveMerchandiseIds(filteredProducts.map((p) => p.sku));

  const sortedGroups = rootEntry
    ? sortNavGroups(
        rootEntry.groups.map((group) => ({
          ...group,
          skuCount: filterProductsForNode(
            products,
            2,
            { rootLabel: rootEntry.label, groupLabel: group.label },
            showAll,
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
            showAll,
          ).length,
        }))
      : [];
  const subGroupCountBySlug = new Map(subGroupFacets.map((facet) => [facet.slug, facet.count]));

  const isDev = process.env.NODE_ENV !== "production";
  const showDiagnostics = isDev && process.env.NEXT_PUBLIC_SHOW_NAV_DIAGNOSTICS === "1";
  const isResolved = Boolean(rootEntry && groupEntry);

  const Breadcrumb = () => (
    <div className="space-y-1 text-sm text-neutral-500">
      <Link
        href={`/products/${rootSlug}`}
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
            <span className="text-neutral-900">{groupEntry.label}</span>
          </>
        ) : null}
      </div>
    </div>
  );

  const filtersPanel = rootEntry ? (
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
            selected: group.slug === groupEntry?.slug,
          })),
        },
        ...(groupEntry?.items?.length
          ? [
              {
                title: "Sub-groups",
                items: groupEntry.items.map((item) => ({
                  label: item.label,
                  slug: item.slug,
                  href: `/products/${rootEntry.slug}/${groupEntry.slug}/${item.slug}`,
                  count: subGroupCountBySlug.get(item.slug) ?? 0,
                  selected: false,
                })),
              },
            ]
          : []),
      ]}
      currentLevel={groupEntry ? 1 : 0}
      backHrefs={[undefined, `/products/${rootEntry.slug}`]}
    />
  ) : null;

  const ProductGrid = () => (
    <div className="space-y-4">
      {filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-700 space-y-2">
          <p>Select a sub-group/range to view products.</p>
          {!showAll ? (
            <Link
              href={`/products/${rootEntry!.slug}/${groupEntry!.slug}?show=all`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
            >
              Show all items in this section
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductTile
              key={product.sku}
              product={{ ...product, merchandiseId: merchandiseMap[product.sku] ?? null }}
              currencyCode={storeCurrency}
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
            rootLabel,
            groupLabel,
            rootResolved: Boolean(rootEntry),
            groupResolved: Boolean(groupEntry),
            lookup: {
              root: slug_map.lookup.rootBySlug[rootSlug],
              group: slug_map.lookup.groupBySlug[rootSlug]?.[groupSlug],
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
                  lookup: slug_map.lookup,
                  treeRoots: tree.map((r) => ({ label: r.label, slug: r.slug })),
                  groupsForRoot: rootEntry?.groups?.map((g) => ({
                    label: g.label,
                    slug: g.slug,
                  })),
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
        <h1 className="text-3xl font-bold text-neutral-900">{groupEntry?.label ?? groupLabel ?? ""}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Browse {groupEntry?.label ?? groupLabel ?? "this group"} products and parts.
        </p>
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
