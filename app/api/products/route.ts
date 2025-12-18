import { NextResponse } from "next/server";

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

export async function GET() {
  if (!SHOP_DOMAIN || !ADMIN_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN",
      },
      { status: 500 }
    );
  }

  const query = `
    query {
      products(first: 20) {
        nodes {
          id
          title
          handle
          status
        }
      }
    }
  `;

  const res = await fetch(
    `https://${SHOP_DOMAIN}/admin/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN,
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

  return NextResponse.json({ ok: true, products: json.data.products.nodes });
}
