import { QuickCartClient } from "./QuickCartClient";
import { getPimProducts } from "lib/pim/source";
import { resolveMerchandiseIds } from "lib/shopify/skuResolver";

export const revalidate = 0;

export default async function QuickCartPage() {
  const products = await getPimProducts();
  const merchandiseMap = await resolveMerchandiseIds(products.map((p) => p.sku));

  const payload = products.map((p) => ({
    sku: p.sku,
    name: p.product_name || p.nav_group || p.handle || p.sku,
    price: p.price_trade_gbp ?? null,
    handle: p.handle ?? null,
    merchandiseId: merchandiseMap[p.sku] ?? null,
  }));

  return (
    <div className="space-y-6">
      <QuickCartClient products={payload} />
    </div>
  );
}
