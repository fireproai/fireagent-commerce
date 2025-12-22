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

  return (
    <section>
      {/* Optional: Render internal metadata safely */}
      <h1 className="text-2xl font-bold mb-4">{pageTitle}</h1>
      <p className="text-neutral-500 mb-6">{pageDescription}</p>

      {products.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 p-4 text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          No products found in this collection.
        </div>
      ) : (
        <Grid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <ProductGridItems products={products} />
        </Grid>
      )}
    </section>
  );
}
