import { cookies } from "next/headers";

import { QuickQuoteClient, type QuickQuoteTab } from "./QuickQuoteClient";
import { getQuickBuilderProducts } from "lib/quick/products";
import { getRecentQuotes } from "lib/quotes";
import { getStoreCurrency } from "lib/shopify/storeCurrency";

export const revalidate = 0;

async function isLoggedIn() {
  const jar = await cookies();
  const markers = ["_secure_customer_sig", "customer_signed_in", "customerLoggedIn"];
  return markers.some((name) => jar.get(name));
}

const VALID_TABS: QuickQuoteTab[] = ["quote", "catalogue", "summary", "quotes"];

function normalizeTabParam(tab?: string | string[] | null): QuickQuoteTab {
  if (typeof tab === "string" && VALID_TABS.includes(tab as QuickQuoteTab)) return tab as QuickQuoteTab;
  return "catalogue";
}

export default async function QuickQuotePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await Promise.resolve(searchParams ?? {})) as Record<string, string | string[] | undefined>;
  const fromQuote = Array.isArray(sp.from_quote) ? sp.from_quote[0] : sp.from_quote;
  const fromQuoteToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const fromQuoteEmail = Array.isArray(sp.e) ? sp.e[0] : sp.e;
  const loggedIn = await isLoggedIn();
  const products = await getQuickBuilderProducts();
  const storeCurrency = await getStoreCurrency();
  const quotes = loggedIn ? await getRecentQuotes({ limit: 50 }) : [];
  const initialQuotes = quotes.map((quote) => ({
    id: quote.id,
    quote_number: quote.quote_number,
    status: quote.status,
    created_at: quote.created_at.toISOString(),
    issued_at: quote.issued_at ? quote.issued_at.toISOString() : null,
    total_value: quote.total_value,
    currency: quote.currency,
    publicToken: quote.publicToken,
    publicTokenExpiresAt: quote.publicTokenExpiresAt ? quote.publicTokenExpiresAt.toISOString() : null,
  }));

  const initialTab = fromQuote ? "quote" : normalizeTabParam(sp.tab ?? null);

  return (
    <QuickQuoteClient
      products={products}
      initialQuotes={initialQuotes}
      isLoggedIn={loggedIn}
      initialTab={initialTab}
      storeCurrency={storeCurrency}
      initialFromQuote={fromQuote ?? null}
      initialFromQuoteToken={fromQuoteToken ?? null}
      initialFromQuoteEmail={fromQuoteEmail ?? null}
    />
  );
}
