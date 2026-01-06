import { cookies } from "next/headers";

import { QuickQuoteClient } from "./QuickQuoteClient";
import { getQuickBuilderProducts } from "lib/quick/products";
import { getRecentQuotes } from "lib/quotes";

export const revalidate = 0;

async function isLoggedIn() {
  const jar = await cookies();
  const markers = ["_secure_customer_sig", "customer_signed_in", "customerLoggedIn"];
  return markers.some((name) => jar.get(name));
}

export default async function QuickQuotePage() {
  const loggedIn = await isLoggedIn();
  const products = await getQuickBuilderProducts();
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

  return <QuickQuoteClient products={products} initialQuotes={initialQuotes} isLoggedIn={loggedIn} />;
}
