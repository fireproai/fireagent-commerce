import { QuickQuoteClient } from "./QuickQuoteClient";
import { getQuickBuilderProducts } from "lib/quick/products";

export const revalidate = 0;

export default async function QuickQuotePage() {
  const products = await getQuickBuilderProducts();
  return <QuickQuoteClient products={products} />;
}
