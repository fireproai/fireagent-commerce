import { getCollection, getCollectionProducts } from 'lib/shopify';
import { Metadata } from 'next';

import Grid from 'components/grid';
import ProductGridItems from 'components/layout/product-grid-items';
import { defaultSort, sorting } from 'lib/constants';

// ⭐ STATIC METADATA (does NOT trigger OG auto-routes)
export const metadata: Metadata = {
  title: 'Collection',
  description: 'Browse collection products'
};

export default async function CategoryPage(props: {
  params: Promise<{ collection: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const collectionHandle = params.collection;
  const collection = await getCollection(collectionHandle);

  // Dynamic metadata inside the page (safe — does NOT trigger OG generation)
  const pageTitle =
    collection?.seo?.title || collection?.title || 'Collection';
  const pageDescription =
    collection?.seo?.description ||
    collection?.description ||
    `${collectionHandle} products`;

  // Sorting logic
  const { sort } = (searchParams as { [key: string]: string }) || {};
  const { sortKey, reverse } =
    sorting.find((item) => item.slug === sort) || defaultSort;

  const products = await getCollectionProducts({
    collection: collectionHandle,
    sortKey,
    reverse
  });

  const pageSize = 12;
  const page =
    Number(((searchParams as { [key: string]: string }) || {}).page) > 0
      ? Number(((searchParams as { [key: string]: string }) || {}).page)
      : 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pagedProducts = products.slice(start, end);
  const hasMore = products.length > end;

  return (
    <section>
      {/* Optional: Render internal metadata safely */}
      <h1 className="text-2xl font-bold mb-2">{pageTitle}</h1>
      <p className="text-neutral-900 mb-4">{pageDescription}</p>
      <div className="mb-4 text-sm text-neutral-600">
        {products.length} results
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 p-4 text-neutral-600">
          No products found in this collection.
        </div>
      ) : (
        <>
          <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <ProductGridItems products={pagedProducts} />
          </Grid>
          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <a
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                href={`?page=${page + 1}${sort ? `&sort=${sort}` : ''}`}
              >
                Load more
              </a>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
