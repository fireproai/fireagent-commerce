import fs from "node:fs/promises";

import Link from "next/link";

import { PIM_NAV_PATH, getPimNavRoots } from "lib/pim/source";

export const revalidate = 600;

export default async function ProductsLandingPage() {
  const roots = await getPimNavRoots();

  const debugInfo =
    roots.length === 0 && process.env.NODE_ENV === "development"
      ? await (async () => {
          try {
            const raw = await fs.readFile(PIM_NAV_PATH, "utf-8");
            const parsed = JSON.parse(raw);
            const tree = Array.isArray(parsed.tree) ? parsed.tree : [];
            const first = tree[0];
            return JSON.stringify(
              {
                file: PIM_NAV_PATH,
                treeCount: tree.length,
                firstRootKeys:
                  first && typeof first === "object" ? Object.keys(first as Record<string, unknown>) : [],
              },
              null,
              2
            );
          } catch (error) {
            return JSON.stringify(
              {
                file: PIM_NAV_PATH,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            );
          }
        })()
      : null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <span className="text-sm text-neutral-600">{roots.length} categories</span>
      </div>

      {roots.length === 0 ? (
        <div className="space-y-2">
          <p className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-600">
            No navigation data available.
          </p>
          {debugInfo ? (
            <pre className="overflow-auto rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              {debugInfo}
            </pre>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((root) => (
            <Link
              key={root.slug}
              href={`/products/${root.slug}`}
              className="group flex flex-col justify-between rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
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
                {root.groups.length > 6 ? (
                  <span className="text-neutral-400">+{root.groups.length - 6} more</span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
