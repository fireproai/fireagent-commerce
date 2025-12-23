export const dynamic = "force-dynamic";
export const revalidate = 0;
import { notFound } from "next/navigation";

import { Breadcrumbs } from "components/Breadcrumbs";
import { GridTileImage } from "components/grid/tile";
import Footer from "components/layout/footer";
import { Gallery } from "components/product/gallery";
import { ProductProvider } from "components/product/product-context";
import { ProductDetails } from "components/product/product-details";
import { ProductDescription } from "components/product/product-description";
import { getMenu, getProductRecommendations } from "lib/shopify";
import { Image, Product } from "lib/shopify/types";
import Link from "next/link";
import { Suspense } from "react";

// ⭐ REMOVED generateMetadata — it triggers Next.js OG auto-routes which use "use cache"

export default async function ProductPage(props: {
  params: Promise<{ handle: string }>;
}) {
  const params = await props.params;
  const product = await getProductFromApi(params.handle);

  if (!product) return notFound();
  const downloads = getDownloadLinks(product);

  const footerMenuHandle =
    process.env.NEXT_PUBLIC_SHOPIFY_FOOTER_MENU_HANDLE || "next-js-frontend-footer-menu";
  const footerMenu = (await getMenu(footerMenuHandle)) || [];

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.featuredImage?.url,
    offers: {
      "@type": "AggregateOffer",
      availability: product.availableForSale
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      priceCurrency:
        product.variants?.[0]?.currencyCode || product.variants?.[0]?.priceAmount
          ? product.variants?.[0]?.currencyCode
          : undefined,
      highPrice: product.variants?.[0]?.priceAmount,
      lowPrice: product.variants?.[0]?.priceAmount,
    },
  };

  return (
    <ProductProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
      />

          <div className="mx-auto max-w-(--breakpoint-2xl) px-4">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/search" },
            { label: product.title },
          ]}
        />
        <div className="flex flex-col rounded-lg border border-neutral-200 bg-white p-6 md:p-8 lg:flex-row lg:items-start lg:gap-8 dark:border-neutral-800 dark:bg-black">
          <div className="h-full w-full basis-full lg:basis-4/6">
            <Suspense
              fallback={
                <div className="relative aspect-square h-full max-h-[550px] w-full overflow-hidden" />
              }
            >
              <Gallery
                images={(product.images ?? []).slice(0, 5).map((image: Image) => ({
                  src: image.url,
                  altText: image.altText,
                }))}
              />
            </Suspense>
          </div>

          <div className="basis-full lg:basis-2/6">
            <Suspense fallback={null}>
              <ProductDescription product={product} downloads={downloads} />
            </Suspense>
          </div>
        </div>

        <ProductDetails descriptionHtml={product.descriptionHtml} downloads={downloads} />

        {/* Related Products */}
        {await RelatedProducts({ id: product.id })}
      </div>

      {/* Footer */}
      {await Footer({ menu: footerMenu })}
    </ProductProvider>
  );
}

async function RelatedProducts({ id }: { id: string }) {
  const relatedProducts = (await getProductRecommendations(id)) || [];

  if (!relatedProducts.length) return null;

  return (
    <div className="py-8">
      <h2 className="mb-4 text-2xl font-bold">Related Products</h2>
      <ul className="flex w-full gap-4 overflow-x-auto pt-1">
        {relatedProducts.map((product) => (
          <li
            key={product.handle}
            className="aspect-square w-full flex-none min-[475px]:w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5"
          >
            <Link
              className="relative h-full w-full"
              href={`/product/${product.handle}`}
              prefetch={true}
            >
              <GridTileImage
                alt={product.title}
                label={{
                  title: product.title,
                  amount: product.variants?.[0]?.priceAmount ?? "",
                  currencyCode: product.variants?.[0]?.currencyCode ?? "",
                }}
                src={product.featuredImage?.url}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, (min-width: 475px) 50vw, 100vw"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getDownloadLinks(product: Product): { url: string; label: string }[] {
  const edges = product?.metafields?.edges || [];
  return edges
    .map((edge) => edge?.node)
    .filter((node): node is NonNullable<typeof node> => Boolean(node?.value))
    .filter(
      (node) =>
        node.type === "url" ||
        node.value.startsWith("http://") ||
        node.value.startsWith("https://")
    )
    .map((node) => ({
      url: node.value,
      label: node.key || "Download",
    }));
}

async function getProductFromApi(handle: string): Promise<Product | undefined> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const res = await fetch(`${baseUrl}/api/product?handle=${encodeURIComponent(handle)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return undefined;
    const data = await res.json().catch(() => null);
    if (!data?.product) return undefined;
    return data.product as Product;
  } catch (err) {
    console.debug("[product page] failed to load product", err);
    return undefined;
  }
}
