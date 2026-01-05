import Link from "next/link";
import { cookies } from "next/headers";

import { QuotesLookupClient } from "./QuotesLookupClient";

async function isLoggedIn() {
  const jar = await cookies();
  const markers = ["_secure_customer_sig", "customer_signed_in", "customerLoggedIn"];
  return markers.some((name) => jar.get(name));
}

function getLoginUrl() {
  const shopDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "mn2jyi-ez.myshopify.com";
  return `https://${shopDomain}/account/login`;
}

export default async function QuotesLookupPage() {
  const loggedIn = await isLoggedIn();
  const loginUrl = getLoginUrl();

  if (!loggedIn) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-neutral-900">Login required</h1>
          <p className="text-sm text-neutral-700">
            Please{" "}
            <Link href={loginUrl} className="text-blue-700 hover:underline">
              log in
            </Link>{" "}
            to view or search your quotes.
          </p>
        </div>
      </section>
    );
  }

  return <QuotesLookupClient />;
}
