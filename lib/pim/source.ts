import fs from "node:fs/promises";
import path from "node:path";

import {
  PIM_NAV_PATH,
  type PimNav,
  type PimNavGroup,
  type PimNavItem,
  type PimNavRoot,
  type PimSlugLookup,
  getPimNav,
  getPimNavRoots,
} from "./nav";

export type PimProduct = {
  sku: string;
  product_name: string;
  nav_root: string;
  nav_group: string;
  nav_group_1?: string;
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

export async function getPimProducts(): Promise<PimProduct[]> {
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
  const parsed = await readJsonFile<unknown>(PIM_SKU_LOOKUP_PATH);
  return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
}

export {
  PIM_NAV_PATH,
  getPimNav,
  getPimNavRoots,
  PimNav,
  PimNavGroup,
  PimNavItem,
  PimNavRoot,
  PimSlugLookup,
};
