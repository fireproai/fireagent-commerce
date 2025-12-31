"use client";

import { useEffect, useMemo, useState } from "react";

import { useCart } from "components/cart/cart-context";
import Image from "next/image";
import Link from "next/link";

import NavMenu, { NavRoot } from "./NavMenu";

export default function Header() {
  const { cart } = useCart();
  const cartCount = cart?.lines?.reduce((sum, line) => sum + (line.quantity || 0), 0) || 0;
  const shopDomain =
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "mn2jyi-ez.myshopify.com";
  const loginUrl = `https://${shopDomain}/account/login`;

  const [navTree, setNavTree] = useState<NavRoot[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const loadNav = async () => {
      try {
        const response = await fetch("/api/nav", { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to fetch navigation");
        const data = await response.json();
        const tree = Array.isArray(data?.tree) ? (data.tree as NavRoot[]) : [];
        if (active) setNavTree(tree);
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setNavTree([]);
      }
    };

    loadNav();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const menuTree = useMemo(() => navTree, [navTree]);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/90 backdrop-blur">
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
              className="hidden sm:inline-flex rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Account / Login
            </a>
            <Link
              href="/cart"
              className="inline-flex items-center rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
            >
              Cart
              {cartCount > 0 ? (
                <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/products"
            className="rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100 text-sm"
          >
            Products
          </Link>
          <Link
            href="/quick-cart"
            className="rounded-lg px-3 py-2 text-neutral-700 hover:bg-neutral-100 text-sm"
          >
            Quick Cart
          </Link>
          <NavMenu tree={menuTree} />

          <div className="flex-1 min-w-[240px] flex items-center">
            <form action="/search" className="ml-auto w-full max-w-md">
              <div className="flex w-full items-center gap-2">
                <input
                  name="q"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200 focus:ring-offset-0"
                  placeholder="Search by SKU, name"
                  aria-label="Search"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
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
