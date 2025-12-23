"use client";

import { AddToCart } from 'components/cart/add-to-cart';
import Price from 'components/price';
import Link from 'next/link';
import { useMemo } from 'react';
import { Product } from 'lib/shopify/types';
import { VariantSelector } from './variant-selector';

type Download = { url: string; label: string };

export function ProductDescription({
  product,
  downloads = []
}: {
  product: Product;
  downloads?: Download[];
}) {
  const options = product.options || [];
  const variants = product.variants || [];
  const firstVariant = variants[0];
  const summary = useMemo(() => {
    if (!product.descriptionHtml) return '';
    const text = product.descriptionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, 180);
  }, [product.descriptionHtml]);
  const primaryDownload = downloads[0];

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 border-b pb-4 dark:border-neutral-700">
        <h1 className="text-4xl font-semibold leading-tight">{product.title}</h1>
        {summary ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2">{summary}</p>
        ) : null}
        <div className="mr-auto w-auto rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white">
          <Price
            amount={firstVariant?.priceAmount || '0'}
            currencyCode={firstVariant?.currencyCode || 'USD'}
          />
        </div>
      </div>

      <div className="mb-3">
        <VariantSelector options={options} variants={variants} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[180px]">
          <AddToCart product={product} />
        </div>
        {primaryDownload ? (
          <Link
            href={primaryDownload.url}
            prefetch={false}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Download Datasheet
          </Link>
        ) : null}
      </div>
    </>
  );
}
