import { NextResponse } from "next/server";

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const ADMIN_API_VERSION = "2024-01";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!SHOP_DOMAIN || !ADMIN_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const handle = searchParams.get("handle");

  if (!handle) {
    return NextResponse.json({ ok: false, error: "handle is required" }, { status: 400 });
  }

  const query = `
    query ProductByHandle($q: String!) {
      shop { currencyCode }
      products(first: 1, query: $q) {
        edges {
          node {
            id
            title
            handle
            status
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                }
              }
            }
          }
        }
      }
    }
  `;
  const variables = { q: `handle:${handle}` };

  const res = await fetch(
    `https://${SHOP_DOMAIN}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    }
  );

  const json = await res.json().catch(() => null);

  if (!res.ok || json?.errors) {
    return NextResponse.json(
      { ok: false, status: res.status, errors: json?.errors ?? json },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  const shopCurrency = json?.data?.shop?.currencyCode || "USD";
  const raw = json?.data?.products?.edges?.[0]?.node;
  if (!raw) {
    return NextResponse.json(
      { ok: true, product: null },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }

  type VariantNode = {
    id: string;
    title: string;
    sku: string | null;
    price?: string | null;
  };

  type Variant = {
    id: string;
    title: string;
    selectedOptions: [];
    price: { amount: string; currencyCode: string } | null;
    sku: string | null;
  };

  const variants: Variant[] =
    raw.variants?.edges
      ?.map((edge: any) => edge?.node)
      ?.filter(Boolean)
      ?.map((node: VariantNode) => {
        const priceObj = node.price
          ? { amount: node.price, currencyCode: shopCurrency }
          : null;
      return {
        id: node.id,
        title: node.title,
        selectedOptions: [],
        price: priceObj,
        sku: node.sku,
      };
      }) || [];

  const prices = variants
    .map((v) => v.price?.amount)
    .filter((v): v is string => typeof v === "string");
  const minPrice = prices.length ? prices.reduce((a, b) => (+a < +b ? a : b)) : "0";
  const maxPrice = prices.length ? prices.reduce((a, b) => (+a > +b ? a : b)) : "0";
  const currencyCode = variants.find((v) => v.price?.currencyCode)?.price?.currencyCode || "USD";

  const product = {
    id: raw.id,
    title: raw.title,
    handle: raw.handle,
    status: raw.status,
    variants,
    priceRange: {
      minVariantPrice: { amount: minPrice, currencyCode },
      maxVariantPrice: { amount: maxPrice, currencyCode },
    },
  };

  return NextResponse.json(
    { ok: true, product },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
