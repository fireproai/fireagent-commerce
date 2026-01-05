import { getPimProducts } from "lib/pim/source";
import { resolveMerchandiseIds } from "lib/shopify/skuResolver";

export type QuickBuilderProduct = {
  sku: string;
  name: string;
  price?: number | null;
  handle?: string | null;
  merchandiseId?: string | null;
  requires_quote?: boolean | null;
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
  }));
}
