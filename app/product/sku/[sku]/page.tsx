import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProductSkuRedirectPage(props: {
  params: Promise<{ sku: string }>;
}) {
  const params = await props.params;
  const sku = params?.sku?.trim();

  if (!sku) {
    return notFound();
  }

  const handle = await getHandleFromApi(sku);

  if (!handle) {
    return notFound();
  }

  redirect(`/product/${handle}`);
}

async function getHandleFromApi(sku: string): Promise<string | null> {
  const normalizedSku = sku.toLowerCase();
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  try {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data?.products?.length) return null;

    const match = data.products.find(
      (product: { handle: string; skus?: string[] }) =>
        Array.isArray(product?.skus) &&
        product.skus.some(
          (value) => typeof value === 'string' && value.toLowerCase() === normalizedSku
        )
    );

    return match?.handle ?? null;
  } catch (err) {
    console.debug('[sku redirect] failed to resolve sku', err);
    return null;
  }
}
