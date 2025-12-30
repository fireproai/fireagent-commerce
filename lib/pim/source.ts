import fs from "node:fs/promises";
import path from "node:path";

import { slugify } from "lib/plytix/slug";

import {
  PIM_NAV_PATH,
  PIM_SAMPLE_PATH,
  type PimNav,
  type PimNavGroup,
  type PimNavItem,
  type PimNavRoot,
  type PimSlugLookup,
  buildLookup,
  getPimNav,
  getPimNavRoots,
} from "./nav";

export type PimProduct = {
  sku: string;
  product_name: string;
  nav_root: string;
  nav_group: string;
  nav_group_1?: string;
  nav_group_2?: string;
  nav_group_3?: string;
  handle: string;
  price_trade_gbp?: number;
};

export const PIM_PRODUCTS_PATH = path.join(process.cwd(), "data", "pim", "pim_products.json");
export const PIM_SKU_LOOKUP_PATH = path.join(process.cwd(), "data", "pim", "sku_lookup.json");

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeSampleRows(raw: string): any[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

type NavAccumulator = {
  slug: string;
  skuCount: number;
  groups: Map<
    string,
    {
      slug: string;
      skuCount: number;
      items: Map<
        string,
        { slug: string; skuCount: number; items: Map<string, { slug: string; skuCount: number; items: Map<string, { slug: string; skuCount: number }> }> }
      >;
    }
  >;
};

async function buildPimDataFromSample(force = false) {
  if (process.env.NODE_ENV === "production") return;
  const needsBuild =
    force ||
    process.env.DEV_REBUILD_PIM === "1" ||
    !(await fileExists(PIM_NAV_PATH)) ||
    !(await fileExists(PIM_PRODUCTS_PATH));
  if (!needsBuild) return;

  try {
    const raw = await fs.readFile(PIM_SAMPLE_PATH, "utf-8");
    const rows = normalizeSampleRows(raw);

    const roots = new Map<string, NavAccumulator>();
    const products: PimProduct[] = [];
    const skuLookup: Record<string, string> = {};

    rows.forEach((row: any, index) => {
      const sku = typeof row.SKU === "string" ? row.SKU.trim() : "";
      const product_name = typeof row.Label === "string" ? row.Label.trim() : "";
      const nav_root = typeof row.nav_root === "string" ? row.nav_root.trim() : "";
      const nav_group = typeof row.nav_group === "string" ? row.nav_group.trim() : "";
      const nav_group_1 = typeof row.nav_group_1 === "string" ? row.nav_group_1.trim() : undefined;
      const nav_group_2 = typeof row.nav_group_2 === "string" ? row.nav_group_2.trim() : undefined;
      const nav_group_3 = typeof row.nav_group_3 === "string" ? row.nav_group_3.trim() : undefined;
      if (!sku || !product_name || !nav_root || !nav_group) return;

      const handle = slugify(sku || product_name || `item-${index}`);
      const price_trade_gbp =
        typeof row.price === "number"
          ? row.price
          : typeof row.price === "string"
            ? Number(row.price)
            : undefined;

      products.push({
        sku,
        product_name,
        nav_root,
        nav_group,
        nav_group_1,
        nav_group_2,
        nav_group_3,
        handle,
        price_trade_gbp: Number.isFinite(price_trade_gbp) ? Number(price_trade_gbp) : undefined,
      });
      skuLookup[slugify(sku)] = handle;

      if (!roots.has(nav_root)) {
        roots.set(nav_root, {
          slug: slugify(nav_root),
          skuCount: 0,
          groups: new Map(),
        });
      }
      const rootEntry = roots.get(nav_root)!;
      rootEntry.skuCount += 1;

      if (!rootEntry.groups.has(nav_group)) {
        rootEntry.groups.set(nav_group, {
          slug: slugify(nav_group),
          skuCount: 0,
          items: new Map(),
        });
      }
      const groupEntry = rootEntry.groups.get(nav_group)!;
      groupEntry.skuCount += 1;

      if (nav_group_1) {
        if (!groupEntry.items.has(nav_group_1)) {
          groupEntry.items.set(nav_group_1, {
            slug: slugify(nav_group_1),
            skuCount: 0,
            items: new Map(),
          });
        }
        const group1Entry = groupEntry.items.get(nav_group_1)!;
        group1Entry.skuCount += 1;

        if (nav_group_2) {
          if (!group1Entry.items.has(nav_group_2)) {
            group1Entry.items.set(nav_group_2, {
              slug: slugify(nav_group_2),
              skuCount: 0,
              items: new Map(),
            });
          }
          const group2Entry = group1Entry.items.get(nav_group_2)!;
          group2Entry.skuCount += 1;

          if (nav_group_3) {
            if (!group2Entry.items.has(nav_group_3)) {
              group2Entry.items.set(nav_group_3, {
                slug: slugify(nav_group_3),
                skuCount: 0,
                items: new Map(),
              });
            }
            const group3Entry = group2Entry.items.get(nav_group_3)!;
            group3Entry.skuCount += 1;
          }
        }
      }
    });

    const tree: PimNavRoot[] = Array.from(roots.entries()).map(([label, rootData]) => ({
      label,
      slug: rootData.slug,
      skuCount: rootData.skuCount,
      groups: Array.from(rootData.groups.entries()).map(([groupLabel, groupData]) => ({
        label: groupLabel,
        slug: groupData.slug,
        skuCount: groupData.skuCount,
        items: Array.from(groupData.items.entries()).map(([itemLabel, itemData]) => ({
          label: itemLabel,
          slug: itemData.slug,
          skuCount: itemData.skuCount,
          items: Array.from(itemData.items.entries()).map(([item2Label, item2Data]) => ({
            label: item2Label,
            slug: item2Data.slug,
            skuCount: item2Data.skuCount,
            items: Array.from(item2Data.items.entries()).map(([item3Label, item3Data]) => ({
              label: item3Label,
              slug: item3Data.slug,
              skuCount: item3Data.skuCount,
              items: [],
            })),
          })),
        })),
      })),
    }));

    const nav: PimNav = {
      updated_at: new Date().toISOString(),
      tree,
      slug_map: {
        roots: tree,
        lookup: buildLookup(tree),
      },
    };

    await fs.mkdir(path.dirname(PIM_NAV_PATH), { recursive: true });
    await fs.writeFile(PIM_NAV_PATH, JSON.stringify(nav, null, 2));
    await fs.writeFile(PIM_PRODUCTS_PATH, JSON.stringify(products, null, 2));
    await fs.writeFile(PIM_SKU_LOOKUP_PATH, JSON.stringify(skuLookup, null, 2));

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[pim] rebuilt pim data from sample");
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[pim] failed to rebuild from sample", error);
    }
  }
}

let ensured = false;
async function ensurePimData() {
  if (ensured) return;
  ensured = true;
  await buildPimDataFromSample();
}

export async function getPimProducts(): Promise<PimProduct[]> {
  await ensurePimData();
  const parsed = await readJsonFile<unknown>(PIM_PRODUCTS_PATH);
  const products = Array.isArray(parsed) ? (parsed as PimProduct[]) : [];

  if (process.env.NODE_ENV !== "production") {
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    products.forEach((product, index) => {
      const handleKey = (product.handle ?? "").toLowerCase();
      if (!handleKey) return;
      if (seen.has(handleKey)) {
        duplicates.push(handleKey);
      } else {
        seen.set(handleKey, index);
      }
    });
    if (duplicates.length) {
      // eslint-disable-next-line no-console
      console.warn("[pim] duplicate handles detected in pim_products.json", duplicates);
    }
  }

  return products;
}

export async function getSkuLookup(): Promise<Record<string, string>> {
  await ensurePimData();
  const parsed = await readJsonFile<unknown>(PIM_SKU_LOOKUP_PATH);
  return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
}

export {
  PIM_NAV_PATH,
  PIM_SAMPLE_PATH,
  getPimNav,
  getPimNavRoots,
  PimNav,
  PimNavGroup,
  PimNavItem,
  PimNavRoot,
  PimSlugLookup,
  buildPimDataFromSample,
};
