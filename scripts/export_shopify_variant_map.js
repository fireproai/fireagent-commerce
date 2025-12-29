/* eslint-disable no-console */
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const PIM_PRODUCTS_PATH = path.join(process.cwd(), "data", "pim", "pim_products.json");
const MAP_PATH = path.join(process.cwd(), "data", "shopify_variant_map.json");
const MISSING_PATH = path.join(process.cwd(), "data", "shopify_variant_map_missing.json");

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_ADMIN_API_VERSION || "2024-10";

if (!STORE_DOMAIN || !ADMIN_TOKEN) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN in env.");
  process.exit(1);
}

const ENDPOINT = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  const contents = JSON.stringify(data, null, 2);
  await fsp.writeFile(filePath, contents, "utf-8");
}

async function fetchVariantBySku(sku) {
  const query = `
    query VariantBySku($query: String!) {
      productVariants(first: 1, query: $query) {
        nodes {
          id
          sku
          product { handle title }
        }
      }
    }
  `;

  let delay = 400;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables: { query: `sku:${sku}` } }),
    });

    const json = await res.json().catch(() => null);
    const errors = json?.errors || json?.data?.productVariants?.userErrors;

    if (res.status === 429 || (errors && errors.some((e) => e?.message?.includes("throttle")))) {
      await sleep(delay);
      delay = Math.min(delay * 2, 10000);
      continue;
    }

    if (!res.ok || !json) {
      console.warn("[variant-map] request failed", res.status, errors || json);
      return null;
    }

    const nodes = json?.data?.productVariants?.nodes;
    if (Array.isArray(nodes) && nodes.length > 0) {
      return nodes[0];
    }
    return null;
  }

  return null;
}

async function main() {
  const pim = await readJson(PIM_PRODUCTS_PATH, []);
  if (!Array.isArray(pim)) {
    console.error("PIM data not found or invalid at", PIM_PRODUCTS_PATH);
    process.exit(1);
  }

  const existingMap = await readJson(MAP_PATH, {});
  const map = { ...(existingMap || {}) };

  const skus = Array.from(
    new Set(
      pim
        .map((p) => p?.sku)
        .filter(Boolean)
        .map((s) => s.toString().trim()),
    ),
  ).sort();

  const missing = [];

  console.log(`[variant-map] Found ${skus.length} SKUs in PIM, ${Object.keys(map).length} already mapped.`);

  for (const sku of skus) {
    if (map[sku]) continue;

    const variant = await fetchVariantBySku(sku);
    if (variant?.id) {
      map[sku] = variant.id;
      console.log("[variant-map] mapped", sku, "->", variant.id, `(product: ${variant.product?.handle ?? "unknown"})`);
    } else {
      missing.push(sku);
      console.warn("[variant-map] not found", sku);
    }

    await sleep(400);
  }

  await writeJson(MAP_PATH, map);
  await writeJson(MISSING_PATH, missing);

  console.log(`[variant-map] Done. Mapped: ${Object.keys(map).length}. Missing: ${missing.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
