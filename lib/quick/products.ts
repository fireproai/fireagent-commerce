import { getPimProducts } from "lib/pim/source";
import { resolveMerchandiseIds } from "lib/shopify/skuResolver";

export type QuickBuilderProduct = {
  sku: string;
  name: string;
  price?: number | null;
  handle?: string | null;
  merchandiseId?: string | null;
  requires_quote?: boolean | null;
  nav_root?: string | null;
  nav_group?: string | null;
  nav_group_1?: string | null;
  nav_group_2?: string | null;
  nav_group_3?: string | null;
};

export async function getQuickBuilderProducts(): Promise<QuickBuilderProduct[]> {
  const products = await getPimProducts();
  const merchandiseMap = await resolveMerchandiseIds(products.map((p) => p.sku));

  return products.map((p) => ({
    sku: p.sku,
    name: p.product_name || p.nav_group || p.handle || p.sku,
    price: p.price_trade_gbp ?? null,
    handle: p.handle ?? null,
    merchandiseId: merchandiseMap[p.sku] ?? null,
    nav_root: p.nav_root ?? null,
    nav_group: p.nav_group ?? null,
    nav_group_1: p.nav_group_1 ?? null,
    nav_group_2: p.nav_group_2 ?? null,
    nav_group_3: p.nav_group_3 ?? null,
    requires_quote: (p as any)?.requires_quote ?? null,
  }));
}
