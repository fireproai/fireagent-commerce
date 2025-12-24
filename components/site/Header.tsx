"use client";

import { useCart } from "components/cart/cart-context";
import Image from "next/image";
import Link from "next/link";

export default function Header() {
  const { cart } = useCart();
  const cartCount = cart?.lines?.reduce((sum, line) => sum + (line.quantity || 0), 0) || 0;
  const shopDomain =
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "mn2jyi-ez.myshopify.com";
  const loginUrl = `https://${shopDomain}/account/login`;

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/brand/fireagent.png"
              alt="FireAgent"
              width={140}
              height={40}
              className="h-12 w-auto object-contain"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={loginUrl}
              className="hidden sm:inline-flex rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Account / Login
            </a>
            <Link
              href="/cart"
              className="inline-flex items-center rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Cart
              {cartCount > 0 ? (
                <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold text-white dark:bg-white dark:text-black">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/products"
              className="rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              All Products
            </Link>
            <Link
              href="/categories"
              className="rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Categories
            </Link>
            <Link
              href="/support"
              className="rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Support
            </Link>
          </nav>

          <div className="flex-1 min-w-[240px] flex items-center">
            <form action="/search" className="ml-auto w-full max-w-md">
              <div className="flex w-full items-center gap-2">
                <input
                  name="q"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950"
                  placeholder="Search by SKU, name…"
                  aria-label="Search"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
