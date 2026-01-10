import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import pimProducts from "data/pim/pim_products.json";
import { AddToCartButton } from "./AddToCartButton";
import { Card, CardContent } from "components/ui/Card";
import { Accordion } from "components/ui/Accordion";
import { ProductImage } from "components/ui/ProductImage";
import { Tabs } from "components/ui/Tabs";
import { SkuTitle } from "components/product/SkuTitle";
import { canAddToCart, getAvailabilityState } from "lib/commercialState";
import { coerceAmount, formatMoney } from "lib/money";
import { baseUrl } from "lib/utils";
import { getStoreCurrency } from "lib/shopify/storeCurrency";
import { resolveMerchandiseId } from "lib/shopify/skuResolver";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const dynamic = "force-dynamic";

type PimProduct = {
  sku: string;
  product_name?: string;
  handle?: string;
  description?: string;
  nav_root?: string;
  nav_group?: string;
  nav_group_1?: string;
  price_trade_gbp?: number;
  brand?: string;
  requires_quote?: boolean;
  discontinued?: boolean;
};

type ProductWithMerchandise = PimProduct & {
  merchandiseId: string | null;
};

async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

async function loadProduct(handle: string): Promise<ProductWithMerchandise | null> {
  const handleSlug = handle?.toLowerCase() ?? "";
  const products = (Array.isArray(pimProducts) ? pimProducts : []) as PimProduct[];
  const product = products.find((p) => (p.handle ?? "").toLowerCase() === handleSlug);
  if (!product) return null;
  const merchandiseId = await resolveMerchandiseId(product.sku);
  return { ...product, merchandiseId: merchandiseId ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const resolved = await resolveParams<{ handle?: string }>(params);
  const handle = resolved.handle ?? "";
  const product = handle ? await loadProduct(handle) : null;

  if (!product) {
    return {
      title: "Product not found",
    };
  }

  const title = product.product_name || product.sku;
  const displayTitle = (() => {
    const raw = title || "";
    const sentenceEnd = raw.indexOf(".");
    if (sentenceEnd !== -1) return raw.slice(0, sentenceEnd).trim();
    if (raw.length > 80) return raw.slice(0, 80).trim();
    return raw;
  })();
  const description =
    product.description ||
    `Details for ${title}${product.nav_group ? ` in ${product.nav_group}` : ""}.`;
  const canonical = `${baseUrl}/product/${handle}`;
  const ogImage = `${baseUrl}/favicon.ico`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

function formatPrice(price: number | null | undefined, currency: string) {
  const numeric = coerceAmount(price);
  if (numeric === null) return "Price available soon";
  return `${formatMoney(numeric, currency)} (ex VAT)`;
}

export default async function ProductPage(props: { params: Promise<{ handle: string }> }) {
  const params = await resolveParams<{ handle?: string }>(props.params);
  const handleSlug = params.handle?.toLowerCase() ?? "";

  if (!handleSlug) {
    notFound();
  }

  const product = handleSlug ? await loadProduct(handleSlug) : null;
  if (!product) {
    notFound();
  }
  const storeCurrency = await getStoreCurrency();

  const fullTitle = product.product_name || product.description || product.sku;
  const title = product.product_name || product.sku;
  const displayTitle = (() => {
    const raw = fullTitle || "";
    const sentenceEnd = raw.indexOf(".");
    if (sentenceEnd !== -1 && sentenceEnd >= 20) return raw.slice(0, sentenceEnd).trim();
    if (raw.length > 80) return `${raw.slice(0, 80).trim()}…`;
    return raw || title;
  })();
  const priceDisplay = formatPrice(product.price_trade_gbp ?? null, storeCurrency);
  const overviewText = (product.description ?? "").trim();
  const isBare =
    !overviewText ||
    overviewText.length < 20 ||
    overviewText === displayTitle ||
    overviewText === title;
  const requiresQuote = Boolean(product.requires_quote);
  const discontinued = Boolean(product.discontinued);
  const availabilityState = getAvailabilityState({
    merchandiseId: product.merchandiseId,
    requiresQuote,
    discontinued,
  });
  const canAdd = canAddToCart(availabilityState);
  const statusText =
    availabilityState === "available"
      ? "Available"
      : availabilityState === "quote_only"
        ? "Quote only"
        : availabilityState === "discontinued"
          ? "Discontinued"
          : "Unavailable";
  const navRoot = (product.nav_root || "").trim();
  const navGroup = (product.nav_group || "").trim();
  const navGroup1 = (product.nav_group_1 || "").trim();

  const crumbs =
    navRoot || navGroup || navGroup1
      ? [
          { label: "Home", href: "/" },
          ...(navRoot ? [{ label: navRoot, href: `/products/${slugify(navRoot)}` }] : []),
          ...(navGroup
            ? [
                {
                  label: navGroup,
                  href: navRoot
                    ? `/products/${slugify(navRoot)}/${slugify(navGroup)}`
                    : `/products/${slugify(navGroup)}`,
                },
              ]
            : []),
          ...(navGroup1 && navRoot && navGroup
            ? [
                {
                  label: navGroup1,
                  href: `/products/${slugify(navRoot)}/${slugify(navGroup)}/${slugify(navGroup1)}`,
                },
              ]
            : []),
        ]
      : [
          { label: "Home", href: "/" },
          { label: "Products", href: "/products" },
        ];
  const overviewContent = isBare
    ? "Trade product information is being prepared. Please check back soon."
    : overviewText;
  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: <p className="leading-6">{overviewContent}</p>,
    },
    {
      id: "technical",
      label: "Technical data",
      content: <p className="leading-6">Technical data will appear here.</p>,
    },
    {
      id: "downloads",
      label: "Downloads",
      content: <p className="leading-6">Datasheets and manuals will appear here.</p>,
    },
  ];
  const related = {
    required: [] as any[],
    recommended: [] as any[],
    spares: [] as any[],
  };
  tabs.push({
    id: "accessories",
    label: "Accessories & spares",
    content: (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Required items</h3>
          <p className="mt-1 text-sm text-neutral-700">
            {related.required.length
              ? "Related required items will appear here."
              : "Required items will appear here (e.g., detector bases)."}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Recommended accessories</h3>
          <p className="mt-1 text-sm text-neutral-700">
            {related.recommended.length
              ? "Recommended accessories will appear here."
              : "Recommended accessories will appear here."}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Spares</h3>
          <p className="mt-1 text-sm text-neutral-700">
            {related.spares.length ? "Spares will appear here." : "Spares list will appear here."}
          </p>
        </div>
      </div>
    ),
  });

  const productSchema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    sku: product.sku,
    url: `${baseUrl}/product/${handleSlug}`,
  };
  if (product.brand) {
    productSchema.brand = { "@type": "Brand", name: product.brand };
  }
  const price = product.price_trade_gbp;
  if (price !== null && price !== undefined) {
    productSchema.offers = {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: storeCurrency,
      url: `${baseUrl}/product/${handleSlug}`,
      availability: canAdd ? "https://schema.org/InStock" : undefined,
    };
  }

  return (
    <section className="flex flex-col gap-8">
      <nav className="text-sm text-neutral-600" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <React.Fragment key={`${crumb.label}-${index}`}>
                <li>
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href} className="hover:text-neutral-900">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-neutral-900 font-medium">{crumb.label}</span>
                  )}
                </li>
                {!isLast ? <li aria-hidden="true">/</li> : null}
              </React.Fragment>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[auto,1fr]">
        <Card>
          <CardContent className="space-y-4">
            <div className="grid gap-6 md:grid-cols-12 md:items-center">
              <div className="md:col-span-4">
                <div className="w-full max-w-[320px]">
                  <ProductImage src={null} alt={title} size="lg" />
                </div>
              </div>
              <div className="min-w-0 md:col-span-8 space-y-2 pt-2 max-w-xl pr-2 md:pr-6">
                <SkuTitle
                  sku={product.sku}
                  title={fullTitle}
                  size="md"
                  variant="list"
                  className="max-w-2xl space-y-1"
                />
                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs text-neutral-500">Trade price</div>
                    <div className="text-base font-medium text-neutral-900">{priceDisplay}</div>
                  </div>
                  <div className="md:w-auto w-full">
                    {canAdd ? (
                      <AddToCartButton
                        merchandiseId={product.merchandiseId!}
                        sku={product.sku}
                        title={title}
                        priceAmount={product.price_trade_gbp?.toFixed(2)}
                        currencyCode={storeCurrency}
                      />
                    ) : (
                      <div className="w-full rounded-lg bg-neutral-100 px-4 py-2.5 text-center text-sm font-medium text-neutral-700">
                        {requiresQuote ? "Quote only" : "Unavailable"}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.brand ? (
                    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700">
                      {product.brand}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700">
                    {statusText}
                  </span>
                </div>
                <div className="mt-3 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                  <p className="text-sm font-semibold text-neutral-900">Common add-ons</p>
                  <p className="mt-1 text-xs text-neutral-600">
                    Compatible items (bases, batteries, accessories) will appear here.
                  </p>
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-neutral-100 bg-white px-4 py-3 shadow-sm">
        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700">
          Trade-only supply
        </span>
        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700">
          Professional installation required
        </span>
        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700">
          Suitable for UK & EU installations
        </span>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="hidden md:block">
            <Tabs tabs={tabs} />
          </div>
          <div className="md:hidden">
            <Accordion items={tabs} />
          </div>
        </CardContent>
      </Card>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
    </section>
  );
}
