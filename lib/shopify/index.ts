import {
  HIDDEN_PRODUCT_TAG,
  SHOPIFY_GRAPHQL_API_ENDPOINT,
  TAGS,
} from "lib/constants";
import { isShopifyError } from "lib/type-guards";
import { ensureStartsWith } from "lib/utils";
import { revalidateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  addToCartMutation,
  createCartMutation,
  editCartItemsMutation,
  removeFromCartMutation,
} from "./mutations/cart";
import { getCartQuery } from "./queries/cart";
import {
  getCollectionProductsQuery,
  getCollectionQuery,
  getCollectionsQuery,
} from "./queries/collection";
import { getMenuQuery } from "./queries/menu";
import { getPageQuery, getPagesQuery } from "./queries/page";
import {
  getProductQuery,
  getProductRecommendationsQuery,
  getProductsQuery,
  getProductHandleBySkuQuery,
} from "./queries/product";
import {
  Cart,
  Collection,
  Connection,
  Image,
  Menu,
  Page,
  Product,
  ShopifyAddToCartOperation,
  ShopifyCart,
  ShopifyCartOperation,
  ShopifyCollection,
  ShopifyCollectionOperation,
  ShopifyCollectionProductsOperation,
  ShopifyCollectionsOperation,
  ShopifyCreateCartOperation,
  ShopifyMenuOperation,
  ShopifyPageOperation,
  ShopifyPagesOperation,
  ShopifyProduct,
  ShopifyProductOperation,
  ShopifyProductRecommendationsOperation,
  ShopifyProductHandleBySkuOperation,
  ShopifyProductsOperation,
  ShopifyRemoveFromCartOperation,
  ShopifyUpdateCartOperation,
} from "./types";

// Safe wrapper for Next.js canary TS mismatch
const revalidateTagSafe = (tag: string) => (revalidateTag as any)(tag);

const domain = process.env.SHOPIFY_STORE_DOMAIN
  ? ensureStartsWith(process.env.SHOPIFY_STORE_DOMAIN, "https://")
  : "";
const endpoint = `${domain}${SHOPIFY_GRAPHQL_API_ENDPOINT}`;
const key = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!;

type ExtractVariables<T> = T extends { variables: object }
  ? T["variables"]
  : never;

export async function shopifyFetch<T>({
  headers,
  query,
  variables,
}: {
  headers?: HeadersInit;
  query: string;
  variables?: ExtractVariables<T>;
}): Promise<{ status: number; body: T } | null> {
  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": key,
        ...headers,
      },
      body: JSON.stringify({
        ...(query && { query }),
        ...(variables && { variables }),
      }),
    });

    const body = await result.json().catch(() => null);

    const errors = (body as any)?.errors;
    const isUnauthorized =
      result.status === 401 ||
      (Array.isArray(errors) &&
        errors.some(
          (err: any) =>
            err?.extensions?.code === "UNAUTHORIZED" ||
            err?.extensions?.code === "FORBIDDEN"
        ));

    if (isUnauthorized) {
      console.debug(
        "[shopifyFetch] Unauthorized",
        JSON.stringify({
          status: result.status,
          errors,
        })
      );
      return null;
    }

    if (!result.ok || errors) {
      console.debug(
        "[shopifyFetch] Request failed",
        JSON.stringify({
          status: result.status,
          errors,
        })
      );
      return null;
    }

    return {
      status: result.status,
      body,
    };
  } catch (e) {
    const err = isShopifyError(e)
      ? {
          cause: e.cause?.toString() || "unknown",
          status: e.status || 500,
          message: e.message,
        }
      : { error: e };
    console.debug("[shopifyFetch] Exception", JSON.stringify({ err, query }));
    return null;
  }
}

const removeEdgesAndNodes = <T>(array: Connection<T> | undefined): T[] => {
  if (!array?.edges?.length) return [];
  return array.edges.map((edge) => edge?.node).filter(Boolean) as T[];
};

const reshapeCart = (cart: ShopifyCart): Cart => {
  if (!cart.cost?.totalTaxAmount) {
    cart.cost.totalTaxAmount = {
      amount: "0.0",
      currencyCode: cart.cost.totalAmount.currencyCode,
    };
  }

  return {
    ...cart,
    lines: removeEdgesAndNodes(cart.lines),
  };
};

const reshapeCollection = (
  collection: ShopifyCollection | undefined
): Collection | undefined => {
  if (!collection) {
    return undefined;
  }

  return {
    ...collection,
    path: `/search/${collection.handle}`,
  };
};

const reshapeCollections = (collections: ShopifyCollection[]) => {
  const reshapedCollections = [];

  for (const collection of collections) {
    if (collection) {
      const reshapedCollection = reshapeCollection(collection);

      if (reshapedCollection) {
        reshapedCollections.push(reshapedCollection);
      }
    }
  }

  return reshapedCollections;
};

const reshapeImages = (
  images: Connection<Image> | undefined,
  productTitle: string
) => {
  const flattened = removeEdgesAndNodes(images);

  return flattened.map((image) => {
    const filename = image.url.match(/.*\/(.*)\..*/)?.[1];
    return {
      ...image,
      altText: image.altText || `${productTitle} - ${filename}`,
    };
  });
};

const reshapeProduct = (
  product: ShopifyProduct,
  filterHiddenProducts: boolean = true
) => {
  if (
    !product ||
    (filterHiddenProducts && product.tags.includes(HIDDEN_PRODUCT_TAG))
  ) {
    return undefined;
  }

  const { images, variants, ...rest } = product;

  return {
    ...rest,
    images: reshapeImages(images, product.title),
    variants: removeEdgesAndNodes(variants),
  };
};

const reshapeProducts = (products: ShopifyProduct[]) => {
  const reshapedProducts = [];

  for (const product of products) {
    if (product) {
      const reshapedProduct = reshapeProduct(product);

      if (reshapedProduct) {
        reshapedProducts.push(reshapedProduct);
      }
    }
  }

  return reshapedProducts;
};

export async function createCart(): Promise<Cart> {
  const res = await shopifyFetch<ShopifyCreateCartOperation>({
    query: createCartMutation,
  });

  const cart = res?.body?.data?.cartCreate?.cart;
  return cart ? reshapeCart(cart) : (undefined as any);
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const cartId = (await cookies()).get("cartId")?.value!;
  const res = await shopifyFetch<ShopifyAddToCartOperation>({
    query: addToCartMutation,
    variables: {
      cartId,
      lines,
    },
  });
  const cart = res?.body?.data?.cartLinesAdd?.cart;
  return cart ? reshapeCart(cart) : (undefined as any);
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const cartId = (await cookies()).get("cartId")?.value!;
  const res = await shopifyFetch<ShopifyRemoveFromCartOperation>({
    query: removeFromCartMutation,
    variables: {
      cartId,
      lineIds,
    },
  });

  const cart = res?.body?.data?.cartLinesRemove?.cart;
  return cart ? reshapeCart(cart) : (undefined as any);
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const cartId = (await cookies()).get("cartId")?.value!;
  const res = await shopifyFetch<ShopifyUpdateCartOperation>({
    query: editCartItemsMutation,
    variables: {
      cartId,
      lines,
    },
  });

  const cart = res?.body?.data?.cartLinesUpdate?.cart;
  return cart ? reshapeCart(cart) : (undefined as any);
}

export async function getCart(): Promise<Cart | undefined> {
  const cartId = (await cookies()).get("cartId")?.value;

  if (!cartId) {
    return undefined;
  }

  const res = await shopifyFetch<ShopifyCartOperation>({
    query: getCartQuery,
    variables: { cartId },
  });

  const cart = res?.body?.data?.cart;
  if (!cart) {
    return undefined;
  }

  return reshapeCart(cart);
}

export async function getCollection(
  handle: string
): Promise<Collection | undefined> {
  const res = await shopifyFetch<ShopifyCollectionOperation>({
    query: getCollectionQuery,
    variables: {
      handle,
    },
  });

  return reshapeCollection(res?.body?.data?.collection);
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey,
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const res = await shopifyFetch<ShopifyCollectionProductsOperation>({
    query: getCollectionProductsQuery,
    variables: {
      handle: collection,
      reverse,
      sortKey: sortKey === "CREATED_AT" ? "CREATED" : sortKey,
    },
  });

  if (!res?.body?.data?.collection) {
    console.debug(`No collection found for "${collection}", returning empty list.`);
    return [];
  }

  return reshapeProducts(
    removeEdgesAndNodes(res.body.data.collection.products)
  );
}

export async function getCollections(): Promise<Collection[]> {
  const res = await shopifyFetch<ShopifyCollectionsOperation>({
    query: getCollectionsQuery,
  });
  const shopifyCollections = removeEdgesAndNodes(res?.body?.data?.collections);
  const collections = [
    {
      handle: "",
      title: "All",
      description: "All products",
      seo: {
        title: "All",
        description: "All products",
      },
      path: "/search",
      updatedAt: new Date().toISOString(),
    },
    ...reshapeCollections(shopifyCollections).filter(
      (collection) => !collection.handle.startsWith("hidden")
    ),
  ];

  return collections.filter(Boolean) as Collection[];
}

export async function getMenu(handle: string): Promise<Menu[]> {
  const res = await shopifyFetch<ShopifyMenuOperation>({
    query: getMenuQuery,
    variables: { handle },
  });

  const items = res?.body?.data?.menu?.items ?? [];
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "";

  return (
    items.map((item: { title: string; url: string }) => ({
      title: item.title,
      path: item.url
        .replace(domain, "")
        .replace("/collections", "/search")
        .replace("/pages", ""),
    })) || []
  );
}

export async function getPage(handle: string): Promise<Page> {
  const res = await shopifyFetch<ShopifyPageOperation>({
    query: getPageQuery,
    variables: { handle },
  });

  return res?.body?.data?.pageByHandle as Page;
}

export async function getPages(): Promise<Page[]> {
  const res = await shopifyFetch<ShopifyPagesOperation>({
    query: getPagesQuery,
  });

  return removeEdgesAndNodes(res?.body?.data?.pages);
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  const res = await shopifyFetch<ShopifyProductOperation>({
    query: getProductQuery,
    variables: {
      handle,
    },
  });

  const product = res?.body?.data?.product;
  if (!product) return undefined;

  return reshapeProduct(product, false);
}

export async function getProductRecommendations(
  productId: string
): Promise<Product[]> {
  const res = await shopifyFetch<ShopifyProductRecommendationsOperation>({
    query: getProductRecommendationsQuery,
    variables: {
      productId,
    },
  });

  return reshapeProducts(res?.body?.data?.productRecommendations || []);
}

export async function getProducts({
  query,
  reverse,
  sortKey,
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const res = await shopifyFetch<ShopifyProductsOperation>({
    query: getProductsQuery,
    variables: {
      query,
      reverse,
      sortKey,
    },
  });

  return reshapeProducts(removeEdgesAndNodes(res?.body?.data?.products));
}

export async function getProductHandleBySku(
  sku: string
): Promise<string | null> {
  if (!sku) return null;

  const escapedSku = sku.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const res = await shopifyFetch<ShopifyProductHandleBySkuOperation>({
    query: getProductHandleBySkuQuery,
    variables: {
      query: `sku:"${escapedSku}"`,
    },
  });

  if (!res?.body?.data?.productVariants?.edges?.length) return null;

  const variant = res.body.data.productVariants?.edges?.[0]?.node;
  return variant?.product?.handle || null;
}

// -------------------------
// SHOPIFY WEBHOOK REVALIDATOR
// -------------------------
export async function revalidate(req: NextRequest): Promise<NextResponse> {
  const collectionWebhooks = [
    "collections/create",
    "collections/delete",
    "collections/update",
  ];
  const productWebhooks = [
    "products/create",
    "products/delete",
    "products/update",
  ];

  const topic = (await headers()).get("x-shopify-topic") || "unknown";
  const secret = req.nextUrl.searchParams.get("secret");
  const isCollectionUpdate = collectionWebhooks.includes(topic);
  const isProductUpdate = productWebhooks.includes(topic);

  if (!secret || secret !== process.env.SHOPIFY_REVALIDATION_SECRET) {
    console.error("Invalid revalidation secret.");
    return NextResponse.json({ status: 401 });
  }

  if (!isCollectionUpdate && !isProductUpdate) {
    return NextResponse.json({ status: 200 });
  }

  if (isCollectionUpdate) {
    revalidateTagSafe(TAGS.collections);
  }

  if (isProductUpdate) {
    revalidateTagSafe(TAGS.products);
  }

  return NextResponse.json({
    status: 200,
    revalidated: true,
    now: Date.now(),
  });
}
