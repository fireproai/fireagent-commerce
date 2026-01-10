import { QuickCartClient } from "./QuickCartClient";
import { getQuickBuilderProducts } from "lib/quick/products";
import { getStoreCurrency } from "lib/shopify/storeCurrency";

export const revalidate = 0;

export default async function QuickCartPage() {
  const products = await getQuickBuilderProducts();
  const storeCurrency = await getStoreCurrency();
  return <QuickCartClient products={products} storeCurrency={storeCurrency} />;
}
