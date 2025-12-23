import Link from 'next/link';

export default async function SearchPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const products = await getProductsFromApi();

  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">All Products</h1>

      {products.length === 0 ? (
        <p className="py-3 text-lg text-neutral-600 dark:text-neutral-400">{`No products found`}</p>
      ) : (
        <ul className="space-y-3">
          {products.map((product) => (
            <li
              key={product.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-black"
            >
              <Link
                href={`/product/${product.handle}`}
                className="text-lg font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                {product.title}
              </Link>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{product.handle}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function getProductsFromApi(): Promise<{ id: string; title: string; handle: string }[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  try {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    if (!data?.products?.length) return [];

    return data.products.map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle
    }));
  } catch (err) {
    console.debug('[search page] failed to load products', err);
    return [];
  }
}
