import { NextResponse } from "next/server";

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const ADMIN_API_VERSION = "2024-01";

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
    query getProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        handle
        status
        descriptionHtml
        vendor
        productType
        tags
        images(first: 10) {
          nodes {
            url
            altText
            width
            height
          }
        }
        variants(first: 10) {
          nodes {
            id
            sku
            title
            priceV2 {
              amount
              currencyCode
            }
            price
          }
        }
      }
    }
  `;

  const res = await fetch(
    `https://${SHOP_DOMAIN}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables: { handle } }),
      cache: "no-store",
    }
  );

  const json = await res.json().catch(() => null);

  if (!res.ok || json?.errors) {
    return NextResponse.json(
      { ok: false, status: res.status, errors: json?.errors ?? json },
      { status: 500 }
    );
  }

  const raw = json?.data?.productByHandle;
  if (!raw) {
    return NextResponse.json({ ok: true, product: null });
  }

  const images =
    raw.images?.nodes
      ?.filter(Boolean)
      ?.map((img: any) => ({
        url: img.url,
        altText: img.altText,
        width: img.width,
        height: img.height,
      })) ?? [];

  type VariantNode = {
    id: string;
    title: string;
    sku: string | null;
    priceV2?: { amount: string; currencyCode: string };
    price?: string;
  };

  const variants: VariantNode[] =
    raw.variants?.nodes?.map((node: VariantNode) => {
      const priceObj =
        node.priceV2 || (node.price ? { amount: node.price, currencyCode: "USD" } : null);
      return {
        id: node.id,
        title: node.title,
        availableForSale: true,
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
    descriptionHtml: raw.descriptionHtml,
    vendor: raw.vendor,
    productType: raw.productType,
    tags: raw.tags || [],
    featuredImage: images[0] || null,
    images,
    options: [],
    variants,
    priceRange: {
      minVariantPrice: { amount: minPrice, currencyCode },
      maxVariantPrice: { amount: maxPrice, currencyCode },
    },
    seo: {
      title: raw.title,
      description: raw.descriptionHtml || "",
    },
  };

  return NextResponse.json({ ok: true, product });
}
