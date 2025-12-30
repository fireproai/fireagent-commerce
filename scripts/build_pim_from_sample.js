#!/usr/bin/env node
/**
 * Dev utility to regenerate data/pim/nav.json and data/pim/pim_products.json
 * from data/samples/plytix_nav.sample.json.
 *
 * Usage: node scripts/build_pim_from_sample.js
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const PIM_NAV_PATH = path.join(process.cwd(), "data", "pim", "nav.json");
const PIM_PRODUCTS_PATH = path.join(process.cwd(), "data", "pim", "pim_products.json");
const PIM_SAMPLE_PATH = path.join(process.cwd(), "data", "samples", "plytix_nav.sample.json");
const PIM_SKU_LOOKUP_PATH = path.join(process.cwd(), "data", "pim", "sku_lookup.json");

function slugify(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSampleRows(raw) {
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

function buildLookup(tree) {
  const rootBySlug = {};
  const groupBySlug = {};
  const group1BySlug = {};
  const group2BySlug = {};
  const group3BySlug = {};

  tree.forEach((root) => {
    rootBySlug[root.slug] = root.label;
    const groupsForRoot = (groupBySlug[root.slug] = groupBySlug[root.slug] || {});
    const group1ForRoot = (group1BySlug[root.slug] = group1BySlug[root.slug] || {});
    const group2ForRoot = (group2BySlug[root.slug] = group2BySlug[root.slug] || {});
    const group3ForRoot = (group3BySlug[root.slug] = group3BySlug[root.slug] || {});

    root.groups.forEach((group) => {
      groupsForRoot[group.slug] = group.label;
      const group1ForGroup = (group1ForRoot[group.slug] = group1ForRoot[group.slug] || {});
      const group2ForGroup = (group2ForRoot[group.slug] = group2ForRoot[group.slug] || {});
      const group3ForGroup = (group3ForRoot[group.slug] = group3ForRoot[group.slug] || {});

      group.items.forEach((item) => {
        group1ForGroup[item.slug] = item.label;
        const group2ForItem = (group2ForGroup[item.slug] = group2ForGroup[item.slug] || {});
        const group3ForItem = (group3ForGroup[item.slug] = group3ForGroup[item.slug] || {});

        item.items.forEach((item2) => {
          group2ForItem[item2.slug] = item2.label;
          const group3ForItem2 = (group3ForItem[item2.slug] = group3ForItem[item2.slug] || {});

          item2.items.forEach((item3) => {
            group3ForItem2[item3.slug] = item3.label;
          });
        });
      });
    });
  });

  return { rootBySlug, groupBySlug, group1BySlug, group2BySlug, group3BySlug };
}

async function build() {
  const raw = await fs.readFile(PIM_SAMPLE_PATH, "utf-8");
  const rows = normalizeSampleRows(raw);

  const roots = new Map();
  const products = [];
  const skuLookup = {};

  rows.forEach((row, index) => {
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
      roots.set(nav_root, { slug: slugify(nav_root), skuCount: 0, groups: new Map() });
    }
    const rootEntry = roots.get(nav_root);
    rootEntry.skuCount += 1;

    if (!rootEntry.groups.has(nav_group)) {
      rootEntry.groups.set(nav_group, { slug: slugify(nav_group), skuCount: 0, items: new Map() });
    }
    const groupEntry = rootEntry.groups.get(nav_group);
    groupEntry.skuCount += 1;

    if (nav_group_1) {
      if (!groupEntry.items.has(nav_group_1)) {
        groupEntry.items.set(nav_group_1, {
          slug: slugify(nav_group_1),
          skuCount: 0,
          items: new Map(),
        });
      }
      const group1Entry = groupEntry.items.get(nav_group_1);
      group1Entry.skuCount += 1;

      if (nav_group_2) {
        if (!group1Entry.items.has(nav_group_2)) {
          group1Entry.items.set(nav_group_2, {
            slug: slugify(nav_group_2),
            skuCount: 0,
            items: new Map(),
          });
        }
        const group2Entry = group1Entry.items.get(nav_group_2);
        group2Entry.skuCount += 1;

        if (nav_group_3) {
          if (!group2Entry.items.has(nav_group_3)) {
            group2Entry.items.set(nav_group_3, {
              slug: slugify(nav_group_3),
              skuCount: 0,
              items: new Map(),
            });
          }
          const group3Entry = group2Entry.items.get(nav_group_3);
          group3Entry.skuCount += 1;
        }
      }
    }
  });

  const tree = Array.from(roots.entries()).map(([label, rootData]) => ({
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

  const nav = {
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

  console.log("[pim] rebuilt");
  console.log("nav:", path.relative(process.cwd(), PIM_NAV_PATH));
  console.log("products:", path.relative(process.cwd(), PIM_PRODUCTS_PATH));
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
