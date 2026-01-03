import { NextResponse } from "next/server";

import { getShopifyConfig } from "lib/shopify";
import { getVariantMapWithMeta } from "lib/shopify/skuResolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const probeQuery = `
  query Probe {
    shop {
      name
    }
  }
`;

export async function GET() {
  const config = getShopifyConfig();
  const hasEnv = Boolean(config.endpoint && config.token);
  const isDev = process.env.NODE_ENV !== "production";
  let storefrontStatus: number | null = null;
  let storefrontError: string | null = null;
  let probeBody: any = null;
  let shopifyErrors: any[] | null = null;
  let shopifyRawKeys: string[] | null = null;

  if (!hasEnv) {
    return NextResponse.json(
      {
        status: "not_configured",
        ...(isDev
          ? {
              debug: {
                endpointHost: config.endpointHost,
                apiVersion: config.apiVersion,
                envVarNamesUsed: config.envVarNamesUsed,
                lastStatusCode: null,
                lastError: "missing_env",
              },
            }
          : {}),
      },
      { status: 200 }
    );
  }

  try {
    const endpoint =
      config.endpoint ||
      `https://${config.endpointHost}/api/${config.apiVersion}/graphql.json`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": config.token,
      },
      body: JSON.stringify({ query: probeQuery }),
    });
    storefrontStatus = res.status;
    const text = await res.text();
    if (text) {
      try {
        probeBody = JSON.parse(text);
        if (probeBody?.errors && Array.isArray(probeBody.errors)) {
          shopifyErrors = probeBody.errors.slice(0, 2);
        } else if (
          !probeBody?.data &&
          probeBody &&
          typeof probeBody === "object"
        ) {
          shopifyRawKeys = Object.keys(probeBody).slice(0, 5);
        }
      } catch {
        const snippet = text.slice(0, 200);
        storefrontError = snippet || "invalid_json";
      }
    }
    if (!res.ok && !storefrontError) {
      storefrontError =
        res.status === 401
          ? "unauthorized"
          : res.status === 403
            ? "forbidden"
            : "bad_response";
    }
  } catch {
    storefrontError = "fetch_failed";
  }

  const shopName = probeBody?.data?.shop?.name || null;
  const hasShop = Boolean(shopName);

  if (shopifyErrors && !storefrontError) {
    storefrontError = "graphql_errors";
  }

  const storefrontOk = Boolean(hasShop && !storefrontError);

  const { meta } = await getVariantMapWithMeta();
  const adminOk = !meta.lastError;
  const adminError = meta.lastError || null;
  const adminStatusCode: number | null = meta.statusCode ?? null;

  let status: "ok" | "partial" | "unauthorized" = "ok";
  if (!storefrontOk) {
    status = "unauthorized";
  } else if (!adminOk) {
    status = "partial";
  }

  const response: any = {
    status,
    storefront: {
      ok: storefrontOk,
      lastStatusCode: storefrontStatus,
      ...(isDev
        ? {
            shopName: shopName || null,
            errors: shopifyErrors || null,
            rawKeys: shopifyRawKeys || null,
          }
        : {}),
    },
    admin: {
      ok: adminOk,
      lastStatusCode: adminStatusCode,
      error: adminError,
      variantCount: meta.variantCount,
    },
    variantCountScanned: meta.variantCount,
    lastError: storefrontOk ? adminError : storefrontError || "unauthorized",
  };

  if (isDev) {
    response.debug = {
      endpointHost: config.endpointHost,
      apiVersion: config.apiVersion,
      envVarNamesUsed: config.envVarNamesUsed,
      lastStatusCode: storefrontStatus,
      lastError: storefrontOk ? adminError : storefrontError,
      ...(shopifyErrors ? { shopifyErrors } : {}),
      ...(shopifyRawKeys ? { shopifyRawKeys } : {}),
    };
  }

  return NextResponse.json(response, { status: 200 });
}
