import { NextResponse } from "next/server";

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

const KEYWORDS: Record<string, string[]> = {
  "s4-911-v-vad-hpr": ["smoke", "optical", "photoelectric", "sensor", "detector"],
  "s4-715": ["smoke", "optical", "photoelectric", "sensor", "detector"],
  "mcp": ["mcp", "manual call point", "break glass", "smash glass", "call point", "push button", "bgu"],
};

export async function GET() {
  if (!SHOP_DOMAIN || !STOREFRONT_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN",
      },
      { status: 500 }
    );
  }

  const query = `
    query {
      products(first: 50) {
        nodes {
          id
          title
          handle
          featuredImage {
            url
            altText
          }
          images(first: 1) {
            nodes {
              url
              altText
            }
          }
          variants(first: 10) {
            nodes {
              sku
              price {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(
    `https://${SHOP_DOMAIN}/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    }
  );

  const json = await res.json();

  if (!res.ok || json.errors) {
    return NextResponse.json(
      { ok: false, status: res.status, errors: json.errors ?? json },
      { status: 500 }
    );
  }

  const products =
    json?.data?.products?.nodes?.map(
      (product: {
        id: string;
        title: string;
        handle: string;
        featuredImage?: { url?: string | null; altText?: string | null };
        images?: { nodes?: { url?: string | null; altText?: string | null }[] };
        variants?: { nodes?: { sku?: string | null; price?: { amount?: string; currencyCode?: string } }[] };
      }) => ({
        id: product.id,
        title: product.title,
        handle: product.handle,
        image:
          product.featuredImage?.url ||
          product.images?.nodes?.[0]?.url ||
          null,
        skus:
          product.variants?.nodes
            ?.map((variant) => variant?.sku?.trim())
            .filter((sku): sku is string => Boolean(sku)) ?? [],
        priceAmount: product.variants?.nodes?.[0]?.price?.amount || null,
        currencyCode: product.variants?.nodes?.[0]?.price?.currencyCode || null,
        keywords:
          KEYWORDS[product.handle.toLowerCase()] ??
          KEYWORDS[product.handle] ??
          [],
      })
    ) ?? [];

  return NextResponse.json({ ok: true, products });
}
