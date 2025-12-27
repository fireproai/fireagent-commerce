import { NextResponse } from "next/server";

const rawDomain =
  process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "";
const SHOP_DOMAIN = rawDomain
  .replace(/^https?:\/\//i, "")
  .replace(/\/+$/, "");
const STOREFRONT_TOKEN =
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

export const runtime = "nodejs";

type AttributeInput =
  | {
      key: string;
      value: string;
    }
  | Record<string, string>;

type RequestBody = {
  cartId?: string;
  attributes?: AttributeInput[] | Record<string, string>;
};

function normalizeAttributes(
  attributes: AttributeInput[] | Record<string, string> | undefined
): { key: string; value: string }[] {
  if (!attributes) return [];

  if (Array.isArray(attributes)) {
    return attributes
      .map((item) => {
        if (!item || !("key" in item)) return null;
        const key = String((item as any).key ?? "").trim();
        if (!key) return null;
        const value = String((item as any).value ?? "");
        return { key, value };
      })
      .filter(Boolean) as { key: string; value: string }[];
  }

  return Object.entries(attributes)
    .map(([key, value]) => {
      const normalizedKey = String(key ?? "").trim();
      if (!normalizedKey) return null;
      return { key: normalizedKey, value: String(value ?? "") };
    })
    .filter(Boolean) as { key: string; value: string }[];
}

export async function POST(request: Request) {
  if (!SHOP_DOMAIN || !SHOP_DOMAIN.includes(".")) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing SHOPIFY_STORE_DOMAIN" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  if (!STOREFRONT_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const body: RequestBody = await request.json().catch(() => ({}));
  const cartId = body?.cartId;
  const attributes = normalizeAttributes(body?.attributes);

  if (!cartId || !attributes.length) {
    return NextResponse.json(
      { ok: false, error: "cartId and attributes are required" },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const mutation = `
    mutation cartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) {
      cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
        cart {
          id
          checkoutUrl
          attributes {
            key
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    cartId,
    attributes,
  };

  try {
    const res = await fetch(`https://${SHOP_DOMAIN}/api/2025-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query: mutation, variables }),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);
    const userErrors = json?.data?.cartAttributesUpdate?.userErrors || [];

    if (userErrors.length) {
      return NextResponse.json(
        { ok: false, errors: userErrors },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    if (!res.ok || json?.errors) {
      return NextResponse.json(
        { ok: false, status: res.status, errors: json?.errors ?? json },
        { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    return NextResponse.json(
      { ok: true, cart: json?.data?.cartAttributesUpdate?.cart },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    const safeError =
      (err as any)?.message ? (err as any).message : String(err);
    return NextResponse.json(
      { ok: false, error: safeError },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
