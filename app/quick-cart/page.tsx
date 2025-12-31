import { QuickCartClient } from "./QuickCartClient";
import { getPimProducts } from "lib/pim/source";
import { getMerchandiseIdForSku } from "lib/shopifyVariantMap";

export const revalidate = 0;

export default async function QuickCartPage() {
  const products = await getPimProducts();

  const payload = products.map((p) => ({
    sku: p.sku,
    name: p.product_name || p.nav_group || p.handle || p.sku,
    price: p.price_trade_gbp ?? null,
    handle: p.handle ?? null,
    merchandiseId: getMerchandiseIdForSku(p.sku),
  }));

  return (
    <div className="space-y-6">
      <QuickCartClient products={payload} />
    </div>
  );
}
