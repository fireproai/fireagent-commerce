import { NextResponse } from "next/server";

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!SHOP_DOMAIN || !STOREFRONT_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const lines = Array.isArray(body?.lines) ? body.lines : [];

  const mutation = `
    mutation cartCreate($lines: [CartLineInput!]) {
      cartCreate(input: { lines: $lines }) {
        cart {
          id
          checkoutUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const res = await fetch(`https://${SHOP_DOMAIN}/api/2024-01/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query: mutation,
        variables: { lines },
      }),
      cache: "no-store",
    });

    const json = await res.json();

    if (!res.ok || json.errors || json?.data?.cartCreate?.userErrors?.length) {
      return NextResponse.json(
        { ok: false, status: res.status, errors: json?.errors ?? json?.data?.cartCreate?.userErrors ?? json },
        { status: 500 }
      );
    }

    const cart = json?.data?.cartCreate?.cart;
    return NextResponse.json({ ok: true, cartId: cart?.id, checkoutUrl: cart?.checkoutUrl });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  }
}
