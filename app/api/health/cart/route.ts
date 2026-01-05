import { NextResponse } from "next/server";

import { getShopifyConfig } from "lib/shopify";
import { resolveMerchandiseId } from "lib/shopify/skuResolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CART_CREATE = `
  mutation HealthCartCreate {
    cartCreate(input: {}) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

const CART_LINES_ADD = `
  mutation HealthCartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

const CART_QUERY = `
  query HealthCart($cartId: ID!) {
    cart(id: $cartId) {
      id
      checkoutUrl
      lines(first: 10) {
        edges { node { id quantity merchandise { ... on ProductVariant { id } } } }
      }
    }
  }
`;

type CartCheckResponse = {
  status: "ok" | "fail" | "skipped";
  details: {
    sku: string | null;
    variantIdRedacted: string | null;
    cartIdRedacted: string | null;
    lineCount: number;
    reason?: string;
  };
};

function parseFirstSku(): string | null {
  const raw = process.env.HEALTHCHECK_SKUS || "";
  const first = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || null;
}

function redact(id: string | null | undefined) {
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

async function shopifyCall<T>(config: ReturnType<typeof getShopifyConfig>, query: string, variables?: Record<string, any>) {
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
      body: JSON.stringify({ query, variables }),
    });
    const status = res.status;
    const text = await res.text();
    clearTimeout(timeout);
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // ignore parse errors
    }
    return { status, body };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export async function GET() {
  const config = getShopifyConfig();
  if (!config.storefrontEndpoint || !config.token) {
    const resp: CartCheckResponse = {
      status: "fail",
      details: { sku: null, variantIdRedacted: null, cartIdRedacted: null, lineCount: 0, reason: "missing_storefront_config" },
    };
    return NextResponse.json(resp, { status: 200, headers: noStoreHeaders() });
  }

  const sku = parseFirstSku();
  if (!sku) {
    const resp: CartCheckResponse = {
      status: "skipped",
      details: { sku: null, variantIdRedacted: null, cartIdRedacted: null, lineCount: 0, reason: "no_sample_sku" },
    };
    return NextResponse.json(resp, { status: 200, headers: noStoreHeaders() });
  }

  try {
    const merchandiseId = await resolveMerchandiseId(sku);
    if (!merchandiseId) {
      const resp: CartCheckResponse = {
        status: "fail",
        details: { sku, variantIdRedacted: null, cartIdRedacted: null, lineCount: 0, reason: "merchandise_not_found" },
      };
      return NextResponse.json(resp, { status: 200, headers: noStoreHeaders() });
    }

    const createRes = await shopifyCall(config, CART_CREATE);
    const cartId = createRes.body?.data?.cartCreate?.cart?.id || null;
    const createErrors = createRes.body?.data?.cartCreate?.userErrors;
    if (!cartId || (Array.isArray(createErrors) && createErrors.length)) {
      const resp: CartCheckResponse = {
        status: "fail",
        details: {
          sku,
          variantIdRedacted: redact(merchandiseId),
          cartIdRedacted: cartId ? redact(cartId) : null,
          lineCount: 0,
          reason: "cart_create_failed",
        },
      };
      return NextResponse.json(resp, { status: 200, headers: noStoreHeaders() });
    }

    const addRes = await shopifyCall(config, CART_LINES_ADD, {
      cartId,
      lines: [{ merchandiseId, quantity: 1 }],
    });
    const addErrors = addRes.body?.data?.cartLinesAdd?.userErrors;
    if (!addRes.body?.data?.cartLinesAdd?.cart || (Array.isArray(addErrors) && addErrors.length)) {
      const resp: CartCheckResponse = {
        status: "fail",
        details: {
          sku,
          variantIdRedacted: redact(merchandiseId),
          cartIdRedacted: redact(cartId),
          lineCount: 0,
          reason: "cart_add_failed",
        },
      };
      return NextResponse.json(resp, { status: 200, headers: noStoreHeaders() });
    }

    const cartRes = await shopifyCall(config, CART_QUERY, { cartId });
    const edges = cartRes.body?.data?.cart?.lines?.edges;
    const lineCount = Array.isArray(edges) ? edges.length : 0;
    if (!lineCount) {
      const resp: CartCheckResponse = {
        status: "fail",
        details: {
          sku,
          variantIdRedacted: redact(merchandiseId),
          cartIdRedacted: redact(cartId),
          lineCount,
          reason: "cart_empty",
        },
      };
      return NextResponse.json(resp, { status: 200, headers: noStoreHeaders() });
    }

    const resp: CartCheckResponse = {
      status: "ok",
      details: {
        sku,
        variantIdRedacted: redact(merchandiseId),
        cartIdRedacted: redact(cartId),
        lineCount,
      },
    };
    return NextResponse.json(resp, { status: 200, headers: noStoreHeaders() });
  } catch {
    const resp: CartCheckResponse = {
      status: "fail",
      details: { sku, variantIdRedacted: null, cartIdRedacted: null, lineCount: 0, reason: "cart_probe_failed" },
    };
    return NextResponse.json(resp, { status: 200, headers: noStoreHeaders() });
  }
}
