"use client";

import { useCart } from "components/cart/cart-context";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import NavMenu, { NavRoot } from "./NavMenu";

function getCartLinesArray(cart: any): any[] {
  if (!cart || !cart.lines) return [];
  if (Array.isArray(cart.lines)) return cart.lines;
  if (Array.isArray((cart.lines as any).nodes))
    return (cart.lines as any).nodes;
  if (Array.isArray((cart.lines as any).edges)) {
    return (cart.lines as any).edges.map((e: any) => e?.node).filter(Boolean);
  }
  return [];
}

export default function Header() {
  const shopDomain =
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || "mn2jyi-ez.myshopify.com";
  const loginUrl = `https://${shopDomain}/account/login`;

  const [navTree, setNavTree] = useState<NavRoot[]>([]);
  const pathname = usePathname();
  const { cart } = useCart();
  const cartLines = getCartLinesArray(cart);
  const cartCount = cartLines.reduce(
    (sum, line) => sum + (line?.quantity || 0),
    0
  );

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
      } catch {
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

  const navLinks = [
    {
      href: "/products",
      label: "Products",
      match: (path: string) =>
        path === "/products" || path.startsWith("/products/"),
    },
    {
      href: "/quick-cart",
      label: "Quick Cart",
      match: (path: string) => path.startsWith("/quick-cart"),
    },
    {
      href: "/quick-quote",
      label: "Quick Quote",
      match: (path: string) => path.startsWith("/quick-quote"),
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 h-[56px] bg-white/90 backdrop-blur md:border-b md:border-neutral-200">
        <div className="mx-auto h-full w-full max-w-7xl px-3 sm:px-4">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 pt-[12px] pb-2">
            {/* LEFT: brand + primary modes */}
            <div className="flex min-w-0 items-center gap-2.5">
              <Link
                href="/"
                className="relative -top-px flex h-9 shrink-0 items-center"
              >
                <Image
                  src="/brand/fireagent.png"
                  alt="FireAgent"
                  width={140}
                  height={40}
                  className="h-full w-auto object-contain -translate-y-[9px]"
                  priority
                />
              </Link>

              <nav className="hidden h-9 items-center gap-1 md:flex">
                {navLinks.map((item) => {
                  const isActive = item.match(pathname || "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "inline-flex h-9 items-center rounded-md px-3 text-sm leading-none transition-colors",
                        isActive
                          ? "font-medium text-neutral-900"
                          : "text-neutral-600 hover:text-neutral-900",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  );
                })}

                {/* Keep NavMenu from altering baseline/height */}
                <div className="flex h-9 items-center">
                  <NavMenu tree={menuTree} />
                </div>
              </nav>
            </div>

            {/* RIGHT: search + cart + account */}
            <div className="flex min-w-0 items-center gap-2">
              <form
                action="/search"
                className="flex h-9 min-w-0 items-center gap-2 w-[280px] max-w-[45vw] sm:w-[340px] md:w-[380px]"
              >
                <input
                  name="q"
                  className="h-full w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm leading-none outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200 focus:ring-offset-0"
                  placeholder="Search by SKU or product name"
                  aria-label="Search"
                />
                <button
                  type="submit"
                  className="inline-flex h-full shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium leading-none text-neutral-800 hover:bg-neutral-50"
                >
                  Search
                </button>
              </form>

              <Link
                href="/cart"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-neutral-900 px-3 text-sm font-semibold leading-none text-white hover:bg-neutral-800"
              >
                Cart
                {cartCount > 0 ? (
                  <span className="inline-flex h-5 items-center rounded-full bg-white px-2 text-[11px] font-semibold leading-none text-neutral-900">
                    {cartCount}
                  </span>
                ) : null}
              </Link>

              <a
                href={loginUrl}
                className="hidden sm:inline-flex h-9 shrink-0 items-center rounded-lg border border-neutral-200 px-3 text-sm leading-none text-neutral-700 hover:bg-neutral-50"
              >
                Account / Login
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-neutral-200 bg-white/90 backdrop-blur md:hidden">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1 pb-2.5">
            {navLinks.map((item) => {
              const isActive = item.match(pathname || "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "inline-flex h-9 items-center rounded-md px-3 text-sm leading-none transition-colors",
                    isActive
                      ? "font-medium text-neutral-900"
                      : "text-neutral-600 hover:text-neutral-900",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* Keep NavMenu from altering baseline/height */}
            <div className="flex h-9 items-center">
              <NavMenu tree={menuTree} />
            </div>

            <Link
              href="/cart"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-neutral-900 px-3 text-sm font-semibold leading-none text-white hover:bg-neutral-800"
            >
              Cart
              {cartCount > 0 ? (
                <span className="inline-flex h-5 items-center rounded-full bg-white px-2 text-[11px] font-semibold leading-none text-neutral-900">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
