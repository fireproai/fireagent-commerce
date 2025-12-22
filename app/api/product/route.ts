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
        description
        descriptionHtml
        availableForSale
        updatedAt
        tags
        featuredImage {
          url
          altText
          width
          height
        }
        images(first: 20) {
          edges {
            node {
              url
              altText
              width
              height
            }
          }
        }
        priceRangeV2 {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        options {
          id
          name
          values
        }
        variants(first: 100) {
          nodes {
            id
            title
            availableForSale
            sku
            selectedOptions {
              name
              value
            }
            price {
              amount
              currencyCode
            }
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
    raw.images?.edges
      ?.map((edge: any) => edge?.node)
      ?.filter(Boolean)
      ?.map((img: any) => ({
        url: img.url,
        altText: img.altText,
        width: img.width,
        height: img.height,
      })) ?? [];

  const product = {
    id: raw.id,
    title: raw.title,
    handle: raw.handle,
      status: raw.status,
      description: raw.description,
      descriptionHtml: raw.descriptionHtml,
      availableForSale: raw.availableForSale,
      updatedAt: raw.updatedAt,
      tags: raw.tags || [],
      featuredImage: raw.featuredImage || images[0] || null,
      images,
      options: raw.options || [],
    variants:
      raw.variants?.nodes?.map((node: any) => ({
        id: node.id,
        title: node.title,
        availableForSale: node.availableForSale,
        selectedOptions: node.selectedOptions || [],
        price: node.price,
        sku: node.sku,
      })) || [],
    priceRange: raw.priceRangeV2,
    seo: {
      title: raw.title,
      description: raw.description || "",
    },
  };

  return NextResponse.json({ ok: true, product });
}
