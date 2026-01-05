import { NextResponse } from "next/server";

import { getShopifyConfig } from "lib/shopify";
import { resolveMerchandiseId } from "lib/shopify/skuResolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOP_QUERY = `
  query HealthShop {
    shop {
      name
    }
  }
`;

type CheckStatus = "ok" | "degraded" | "fail" | "skipped";

type CheckResult = {
  status: CheckStatus;
  details?: Record<string, any>;
};

type HealthResponse = {
  status: "ok" | "degraded" | "fail";
  checks: {
    env: CheckResult;
    shopifyStorefront: CheckResult;
    shopifyAdmin: CheckResult;
    plytix?: CheckResult;
    skuSample: CheckResult;
  };
};

const MAX_SAMPLE_SKUS = 25;

function parseSampleSkus(): string[] {
  const raw = process.env.HEALTHCHECK_SKUS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SAMPLE_SKUS);
}

function redactId(id: string | null | undefined) {
  if (!id) return null;
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
}

async function checkShopifyStorefront(config: ReturnType<typeof getShopifyConfig>): Promise<CheckResult> {
  if (!config.storefrontEndpoint || !config.token) {
    return { status: "fail", details: { reason: "missing_storefront_config" } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(config.storefrontEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": config.token,
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ query: SHOP_QUERY }),
    });
    const statusCode = res.status;
    clearTimeout(timeout);
    const bodyText = await res.text();
    let body: any = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      // ignore parse errors
    }

    const shopName = body?.data?.shop?.name || null;
    const errors = Array.isArray(body?.errors) ? body.errors.slice(0, 2) : null;
    if (!res.ok || !shopName) {
      return {
        status: "fail",
        details: {
          lastStatusCode: statusCode,
          reason: errors ? "storefront_errors" : "storefront_unavailable",
          ...(errors ? { errors } : {}),
        },
      };
    }

    return {
      status: "ok",
      details: {
        lastStatusCode: statusCode,
        shopName,
      },
    };
  } catch {
    clearTimeout(timeout);
    return { status: "fail", details: { reason: "storefront_fetch_failed" } };
  }
}

async function checkShopifyAdmin(config: ReturnType<typeof getShopifyConfig>): Promise<CheckResult> {
  if (!config.adminEndpoint || !config.adminToken) {
    return { status: "degraded", details: { reason: "missing_admin_config" } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(config.adminEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.adminToken,
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ query: SHOP_QUERY }),
    });
    const statusCode = res.status;
    clearTimeout(timeout);
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // ignore parse errors
    }

    const shopName = body?.data?.shop?.name || null;
    const errors = Array.isArray(body?.errors) ? body.errors.slice(0, 2) : null;

    if (!res.ok || !shopName) {
      return {
        status: statusCode === 401 || statusCode === 403 ? "fail" : "degraded",
        details: {
          lastStatusCode: statusCode,
          reason: errors ? "admin_errors" : "admin_unavailable",
          ...(errors ? { errors } : {}),
        },
      };
    }

    return {
      status: "ok",
      details: {
        lastStatusCode: statusCode,
        shopName,
      },
    };
  } catch {
    clearTimeout(timeout);
    return { status: "degraded", details: { reason: "admin_fetch_failed" } };
  }
}

async function checkPlytix(): Promise<CheckResult> {
  const apiKey = (process.env.PLYTIX_API_KEY || "").trim();
  const tenantId = (process.env.PLYTIX_TENANT_ID || "").trim();
  if (!apiKey || !tenantId) {
    return { status: "skipped", details: { reason: "missing_env" } };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://api.plytix.com/v1/${tenantId}/products?limit=1`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const ok = res.ok;
    return {
      status: ok ? "ok" : "degraded",
      details: { lastStatusCode: res.status, reason: ok ? undefined : "plytix_unavailable" },
    };
  } catch {
    clearTimeout(timeout);
    return { status: "degraded", details: { reason: "plytix_fetch_failed" } };
  }
}

async function checkSkuSample(sampleSkus: string[]): Promise<CheckResult> {
  if (!sampleSkus.length) {
    return { status: "skipped", details: { reason: "no_sample_skus" } };
  }

  const results = await Promise.all(
    sampleSkus.map(async (sku) => {
      const trimmed = sku.trim();
      if (!trimmed) {
        return { sku, shopify: { ok: false, reason: "empty_sku" } };
      }
      try {
        const merchandiseId = await resolveMerchandiseId(trimmed);
        return {
          sku: trimmed,
          shopify: {
            ok: Boolean(merchandiseId),
            found: Boolean(merchandiseId),
            variantId: merchandiseId ? redactId(merchandiseId) : null,
            reason: merchandiseId ? undefined : "not_found",
          },
        };
      } catch {
        return {
          sku: trimmed,
          shopify: { ok: false, found: false, variantId: null, reason: "lookup_failed" },
        };
      }
    }),
  );

  const total = results.length;
  const okCount = results.filter((r) => r.shopify?.ok).length;
  const status: CheckStatus =
    okCount === total ? "ok" : okCount > 0 ? "degraded" : "fail";

  return {
    status,
    details: {
      total,
      ok: okCount,
      results,
    },
  };
}

export async function GET() {
  const config = getShopifyConfig();
  const sampleSkus = parseSampleSkus();

  const envMissing = [];
  if (!process.env.SHOPIFY_STORE_DOMAIN) envMissing.push("SHOPIFY_STORE_DOMAIN");
  if (!process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN) envMissing.push("SHOPIFY_STOREFRONT_ACCESS_TOKEN");

  const envCheck: CheckResult = {
    status: envMissing.length ? "fail" : "ok",
    details: envMissing.length ? { missing: envMissing } : undefined,
  };

  const [storefront, admin, plytix, skuSample] = await Promise.all([
    checkShopifyStorefront(config),
    checkShopifyAdmin(config),
    checkPlytix(),
    checkSkuSample(sampleSkus),
  ]);

  let overall: HealthResponse["status"] = "ok";
  const checks = [envCheck, storefront, admin, skuSample, plytix];
  const hasFail = checks.some((c) => c?.status === "fail");
  const hasDegraded = checks.some((c) => c?.status === "degraded");

  if (hasFail) overall = "fail";
  else if (hasDegraded) overall = "degraded";

  const response: HealthResponse = {
    status: overall,
    checks: {
      env: envCheck,
      shopifyStorefront: storefront,
      shopifyAdmin: admin,
      skuSample,
    },
  };

  if (plytix) {
    response.checks.plytix = plytix;
  }

  return NextResponse.json(response, { status: 200, headers: noStoreHeaders() });
}
