"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function getCartCountSafe(): number {
  try {
    const raw =
      localStorage.getItem("cart") ??
      localStorage.getItem("fireagent_cart") ??
      localStorage.getItem("fa_cart");

    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;
    if (!Array.isArray(items)) return 0;

    return items.reduce(
      (sum: number, it: any) => sum + (Number(it?.quantity) || 1),
      0
    );
  } catch {
    return 0;
  }
}

export default function Header() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const sync = () => setCartCount(getCartCountSafe());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-neutral-900 text-white text-sm font-bold dark:bg-white dark:text-black">
            FA
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="text-sm font-semibold">FireAgent</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Trade Store
            </div>
          </div>
        </Link>

        <div className="flex-1">
          <form action="/search" className="max-w-xl">
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

        <div className="flex items-center gap-2">
          <Link
            href="/account"
            className="hidden sm:inline-flex rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Account / Login
          </Link>

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
    </header>
  );
}
