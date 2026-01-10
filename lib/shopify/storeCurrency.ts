import { MONEY_FALLBACK_CURRENCY } from "lib/money";
import { shopifyFetch } from "./index";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let currencyCache: { value: string; expiresAt: number } | null = null;
let warnedFallback = false;

const STORE_CURRENCY_QUERY = /* GraphQL */ `
  query storeCurrency {
    shop {
      paymentSettings {
        currencyCode
      }
    }
  }
`;

async function fetchStoreCurrency(): Promise<string | null> {
  const res = await shopifyFetch<{
    data?: {
      shop?: {
        paymentSettings?: { currencyCode?: string | null } | null;
      } | null;
    };
  }>({
    query: STORE_CURRENCY_QUERY,
  });

  const fromPaymentSettings = res?.body?.data?.shop?.paymentSettings?.currencyCode;
  return (fromPaymentSettings || null) as string | null;
}

export async function getStoreCurrency(): Promise<string> {
  const now = Date.now();
  if (currencyCache && currencyCache.expiresAt > now && currencyCache.value) {
    return currencyCache.value;
  }

  const fallback =
    (process.env.NEXT_PUBLIC_SHOPIFY_CURRENCY || process.env.SHOPIFY_FALLBACK_CURRENCY || "").trim() ||
    MONEY_FALLBACK_CURRENCY;

  const currency = await fetchStoreCurrency();
  if (currency) {
    currencyCache = { value: currency, expiresAt: now + CACHE_TTL_MS };
    return currency;
  }

  if (!warnedFallback) {
    console.warn("[storeCurrency] Failed to fetch store currency, falling back to default.");
    warnedFallback = true;
  }

  currencyCache = { value: fallback, expiresAt: now + CACHE_TTL_MS };
  return fallback;
}
