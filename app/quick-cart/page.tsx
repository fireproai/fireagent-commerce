import { QuickCartClient } from "./QuickCartClient";
import { getQuickBuilderProducts } from "lib/quick/products";

export const revalidate = 0;

export default async function QuickCartPage() {
  const products = await getQuickBuilderProducts();
  return <QuickCartClient products={products} />;
}
