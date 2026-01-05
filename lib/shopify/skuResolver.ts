import fs from "node:fs/promises";
import path from "node:path";

import { ensureStartsWith } from "lib/utils";
import { getShopifyConfig } from "lib/shopify";

type VariantMap = Record<string, string>;

const CACHE_PATH = path.join(process.cwd(), "data", "cache", "shopify_variant_map.json");
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VARIANTS = 5000;

type ResolverMeta = {
  variantCount: number;
  sampleSkus: string[];
  domainUsed: string | null;
  lastError: string | null;
  statusCode: number | null;
  debugErrors?: any[] | null;
  debugAdminUrl?: string | null;
  debugAdminError?: string | null;
  debugResolverMarker?: string | null;
};

type CachedEntry = { fetchedAt: number; map: VariantMap; meta: ResolverMeta };

let memoryCache: CachedEntry | null = null;

async function ensureCacheDir() {
  try {
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
  } catch {
    // ignore
  }
}

async function readFileCache(): Promise<CachedEntry | null> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.fetchedAt === "number" &&
      parsed.map &&
      parsed.meta
    ) {
      const meta = parsed.meta as ResolverMeta;
      if (meta.statusCode === undefined) {
        meta.statusCode = null;
      }
      return { fetchedAt: parsed.fetchedAt, map: parsed.map as VariantMap, meta };
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeFileCache(entry: CachedEntry) {
  try {
    await ensureCacheDir();
    await fs.writeFile(CACHE_PATH, JSON.stringify(entry, null, 2));
  } catch {
    // ignore
  }
}

const variantQuery = `
  query VariantSkus($after: String) {
    productVariants(first: 250, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        sku
      }
    }
  }
`;

async function fetchVariantMapWithMeta(): Promise<{ map: VariantMap; meta: ResolverMeta }> {
  const config = getShopifyConfig();
  const domainUsed =
    config.endpointHost ||
    (process.env.SHOPIFY_STORE_DOMAIN
      ? new URL(ensureStartsWith(process.env.SHOPIFY_STORE_DOMAIN, "https://")).hostname
      : null);
  const adminUrl = config.adminEndpoint || "";

  const meta: ResolverMeta = {
    variantCount: 0,
    sampleSkus: [],
    domainUsed,
    lastError: null,
    statusCode: null,
    debugErrors: null,
    debugAdminUrl: process.env.NODE_ENV !== "production" ? adminUrl : null,
    debugAdminError: null,
    debugResolverMarker: process.env.NODE_ENV !== "production" ? "skuResolver-marker-2026-01-03-a" : null,
  };

  const hasToken = Boolean(config.adminToken);
  const hasEndpoint = Boolean(adminUrl);

  if (!hasEndpoint) {
    meta.lastError = "admin_missing_endpoint";
    return { map: {}, meta };
  }

  if (!hasToken) {
    meta.lastError = "admin_missing_token";
    return { map: {}, meta };
  }

  let hasNextPage = true;
  let cursor: string | null = null;
  const map: VariantMap = {};

  while (hasNextPage && meta.variantCount < MAX_VARIANTS) {
    try {
      const res = await fetch(adminUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": config.adminToken,
        },
        body: JSON.stringify({ query: variantQuery, variables: { after: cursor } }),
      });

      meta.statusCode = res.status;

      let body: any = null;
      try {
        const text = await res.text();
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {
            meta.lastError = meta.lastError || "invalid_json";
          }
        }
      } catch {
        meta.lastError = meta.lastError || "invalid_json";
      }

      if (!res.ok) {
        meta.lastError =
          res.status === 401
            ? "admin_unauthorized"
            : res.status === 403
              ? "admin_forbidden"
              : meta.lastError || "admin_bad_response";
        if (body?.errors && Array.isArray(body.errors) && process.env.NODE_ENV !== "production") {
          meta.debugErrors = body.errors.slice(0, 2);
        }
        break;
      }

      if (body?.errors && Array.isArray(body.errors) && process.env.NODE_ENV !== "production") {
        meta.debugErrors = body.errors.slice(0, 2);
      }

      const nodes = body?.data?.productVariants?.nodes ?? [];
      for (const node of nodes) {
        const sku = (node?.sku ?? "").trim();
        if (sku && node?.id) {
          map[sku] = node.id;
          if (meta.sampleSkus.length < 10) meta.sampleSkus.push(sku);
          meta.variantCount += 1;
        }
        if (meta.variantCount >= MAX_VARIANTS) break;
      }

      hasNextPage = Boolean(body?.data?.productVariants?.pageInfo?.hasNextPage);
      cursor = body?.data?.productVariants?.pageInfo?.endCursor || null;
    } catch (err) {
      meta.lastError = "fetch_failed";
      if (process.env.NODE_ENV !== "production") {
        meta.debugAdminError = err instanceof Error ? err.message : String(err);
      }
      break;
    }

    if (!hasNextPage || meta.variantCount >= MAX_VARIANTS) break;
  }

  return { map, meta };
}

export async function getVariantMapWithMeta(): Promise<{ map: VariantMap; meta: ResolverMeta }> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.fetchedAt < TTL_MS) {
    return { map: memoryCache.map, meta: memoryCache.meta };
  }

  const fileCache = await readFileCache();
  if (fileCache && now - fileCache.fetchedAt < TTL_MS) {
    memoryCache = fileCache;
    return { map: fileCache.map, meta: fileCache.meta };
  }

  const fresh = await fetchVariantMapWithMeta();
  if (fresh) {
    memoryCache = { fetchedAt: now, map: fresh.map, meta: fresh.meta };
    writeFileCache(memoryCache);
    return fresh;
  }

  if (memoryCache) return { map: memoryCache.map, meta: memoryCache.meta };
  if (fileCache) return { map: fileCache.map, meta: fileCache.meta };
  return {
    map: {},
    meta: {
      variantCount: 0,
      sampleSkus: [],
      domainUsed: process.env.SHOPIFY_STORE_DOMAIN
        ? new URL(ensureStartsWith(process.env.SHOPIFY_STORE_DOMAIN, "https://")).hostname
        : null,
      lastError: "no_cache",
      statusCode: null,
      debugErrors: null,
      debugAdminUrl:
        process.env.NODE_ENV !== "production"
          ? (() => {
              const cfg = getShopifyConfig();
              return cfg.adminEndpoint || null;
            })()
          : null,
      debugAdminError: null,
      debugResolverMarker: process.env.NODE_ENV !== "production" ? "skuResolver-marker-2026-01-03-a" : null,
    },
  };
}

export async function getVariantMap(): Promise<VariantMap> {
  const { map } = await getVariantMapWithMeta();
  return map;
}

export async function resolveMerchandiseId(sku: string): Promise<string | null> {
  if (!sku) return null;
  const { map } = await getVariantMapWithMeta();
  const key = sku.trim();
  return map[key] ?? null;
}

export async function resolveMerchandiseIdWithMeta(sku: string): Promise<{ merchandiseId: string | null; meta: ResolverMeta }> {
  const normalizedSku = (sku || "").trim();
  if (!normalizedSku) {
    return {
      merchandiseId: null,
      meta: {
        variantCount: 0,
        sampleSkus: [],
        domainUsed: process.env.SHOPIFY_STORE_DOMAIN
          ? new URL(ensureStartsWith(process.env.SHOPIFY_STORE_DOMAIN, "https://")).hostname
          : null,
        lastError: "sku_empty",
        statusCode: null,
        debugErrors: null,
        debugAdminUrl:
          process.env.NODE_ENV !== "production"
            ? (() => {
                const cfg = getShopifyConfig();
                return cfg.adminEndpoint || null;
              })()
            : null,
        debugAdminError: null,
        debugResolverMarker: process.env.NODE_ENV !== "production" ? "skuResolver-marker-2026-01-03-a" : null,
      },
    };
  }
  const { map, meta } = await getVariantMapWithMeta();
  return { merchandiseId: map[normalizedSku] ?? null, meta };
}

export async function resolveMerchandiseIds(
  skus: Array<string | null | undefined>,
): Promise<Record<string, string | null>> {
  const unique = Array.from(
    new Set(skus.map((sku) => (sku ? sku.trim() : "")).filter(Boolean)),
  );
  if (!unique.length) return {};
  const { map } = await getVariantMapWithMeta();
  const result: Record<string, string | null> = {};
  unique.forEach((sku) => {
    result[sku] = map[sku] ?? null;
  });
  return result;
}
