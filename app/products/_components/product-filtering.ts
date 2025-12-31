import type { PimProduct } from "lib/pim/source";

type SlugSelection = {
  rootLabel: string;
  groupLabel?: string;
  group1Label?: string;
  group2Label?: string;
  group3Label?: string;
};

function isEmpty(value?: string | null) {
  return !value || !value.toString().trim();
}

function matchesNode(product: PimProduct, selection: SlugSelection) {
  if (product.nav_root !== selection.rootLabel) return false;
  if (selection.groupLabel && product.nav_group !== selection.groupLabel) return false;
  if (selection.group1Label && product.nav_group_1 !== selection.group1Label) return false;
  if (selection.group2Label && product.nav_group_2 !== selection.group2Label) return false;
  if (selection.group3Label && product.nav_group_3 !== selection.group3Label) return false;
  return true;
}

export function filterProductsForNode(
  products: PimProduct[],
  depth: number,
  selection: SlugSelection,
  showAll: boolean,
): PimProduct[] {
  const base = products.filter((p) => matchesNode(p, selection));
  if (showAll) return base;

  switch (depth) {
    case 1:
      return base.filter((p) => isEmpty(p.nav_group));
    case 2:
      return base.filter((p) => isEmpty(p.nav_group_1));
    case 3:
      return base.filter((p) => isEmpty(p.nav_group_2) && isEmpty(p.nav_group_3));
    case 4:
      return base.filter((p) => isEmpty(p.nav_group_3));
    case 5:
    default:
      return base;
  }
}

export function countByKey(products: PimProduct[], key: keyof PimProduct) {
  const map = new Map<string, number>();
  products.forEach((p) => {
    const raw = p[key];
    const label = typeof raw === "string" ? raw : "";
    if (!label) return;
    map.set(label, (map.get(label) || 0) + 1);
  });
  return map;
}
