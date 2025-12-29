import Link from "next/link";

import { MobileFilters } from "../../../_components/MobileFilters";
import { SidebarFilterList } from "../../../_components/SidebarFilterList";
import { ProductTile } from "../../../_components/ProductTile";
import {
  PIM_NAV_PATH,
  PimNavGroup,
  PimNavItem,
  PimNavRoot,
  getPimNav,
  getPimProducts,
} from "lib/pim/source";
import { getMerchandiseIdForSku } from "lib/shopifyVariantMap";

async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

export const revalidate = 600;

export default async function ProductsByGroup1Page(props: { params: any }) {
  const params = await resolveParams<{ root?: string; group?: string; group1?: string }>(props.params);
  const { tree, slug_map } = await getPimNav();
  const products = await getPimProducts();
  const rootSlug = params.root ?? "";
  const groupSlug = params.group ?? "";
  const group1Slug = params.group1 ?? "";

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

  const itemEntry: PimNavItem | undefined = groupEntry
    ? groupEntry.items.find((item) => item.label === group1Label || item.slug === group1Slug)
    : undefined;

  const filteredProducts =
    rootEntry && groupEntry && itemEntry
      ? products.filter(
          (product) =>
            product.nav_root === rootEntry.label &&
            product.nav_group === groupEntry.label &&
            product.nav_group_1 === itemEntry.label,
        )
      : [];

  const isDev = process.env.NODE_ENV !== "production";
  const showDiagnostics = isDev && process.env.NEXT_PUBLIC_SHOW_NAV_DIAGNOSTICS === "1";
  const isResolved = Boolean(rootEntry && groupEntry && itemEntry);

  const Breadcrumb = () => (
    <div className="space-y-1 text-sm text-neutral-500">
      <Link
        href={`/products/${rootSlug}/${groupSlug}`}
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
        {itemEntry ? (
          <>
            {" / "}
            <span className="text-neutral-900">{itemEntry.label}</span>
          </>
        ) : null}
      </div>
    </div>
  );

  const filtersPanel =
    rootEntry && groupEntry ? (
      <div className="space-y-3">
        <SidebarFilterList
          title="Groups"
          variant="plain"
          items={rootEntry.groups.map((group) => ({
            label: group.label,
            slug: group.slug,
            href: `/products/${rootEntry.slug}/${group.slug}`,
            count: group.skuCount,
            selected: group.slug === groupEntry.slug,
          }))}
        />
        {groupEntry.items.length ? (
          <SidebarFilterList
            title="Sub-groups"
            variant="plain"
            items={groupEntry.items.map((item) => ({
              label: item.label,
              slug: item.slug,
              href: `/products/${rootEntry.slug}/${groupEntry.slug}/${item.slug}`,
              count: item.skuCount,
              selected: item.slug === (itemEntry?.slug ?? ""),
            }))}
          />
        ) : null}
      </div>
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
              product={{ ...product, merchandiseId: getMerchandiseIdForSku(product.sku) }}
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
            rootLabel,
            groupLabel,
            group1Label,
            resolved: Boolean(rootEntry && groupEntry && itemEntry),
            lookup: {
              root: slug_map.lookup.rootBySlug[rootSlug],
              group: slug_map.lookup.groupBySlug[rootSlug]?.[groupSlug],
              group1: slug_map.lookup.group1BySlug[rootSlug]?.[groupSlug]?.[group1Slug],
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
                  lookup: slug_map.lookup,
                  treeRoots: tree.map((r) => ({ label: r.label, slug: r.slug })),
                  groupsForRoot: rootEntry?.groups?.map((g) => ({
                    label: g.label,
                    slug: g.slug,
                  })),
                  itemsForGroup: groupEntry?.items?.map((i) => ({
                    label: i.label,
                    slug: i.slug,
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
        <h1 className="text-3xl font-bold text-neutral-900">{itemEntry!.label}</h1>
        <p className="mt-1 text-sm text-neutral-600">Browse {itemEntry!.label} products and parts.</p>
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
