'use client';

import LogoSquare from 'components/logo-square';
import Link from 'next/link';
import { Suspense } from 'react';
import MobileMenu from './mobile-menu';
import Search, { SearchSkeleton } from './search';
import { usePathname } from 'next/navigation';
import type { Menu } from 'lib/shopify/types';

interface NavbarProps {
  menu: Menu[];
  siteName: string;
}

export default function NavbarClient({ menu, siteName }: NavbarProps) {
  const pathname = usePathname();
  const primaryNav = [
    { title: 'Products', path: '/products' },
    { title: 'Quick Cart', path: '/quick-cart' },
    { title: 'Quick Quote', path: '/quick-quote' }
  ];

  const filteredMenu = menu.filter((item) =>
    primaryNav.some((nav) => nav.path === item.path)
  );

  const navItems =
    filteredMenu.length > 0
      ? primaryNav.map(
          (nav) => filteredMenu.find((item) => item.path === nav.path) ?? nav
        )
      : primaryNav;

  const linkClass = (path: string) => {
    const isActive =
      path === '/products'
        ? pathname === '/products' || pathname?.startsWith('/products/')
        : pathname?.startsWith(path);
    return `rounded-md px-3 py-2 text-sm transition-colors ${
      isActive ? 'font-medium text-neutral-900 bg-neutral-100' : 'text-neutral-600 hover:text-neutral-900'
    }`;
  };

  return (
    <nav className="relative flex items-center justify-between p-4 lg:px-6">
      <div className="block flex-none md:hidden">
        <Suspense fallback={null}>
          <MobileMenu menu={navItems} />
        </Suspense>
      </div>

      <div className="flex w-full items-center">
        <div className="flex w-full md:w-1/3">
          <Link
            href="/"
            prefetch={true}
            className="mr-2 flex w-full items-center justify-center md:w-auto lg:mr-6"
          >
            <LogoSquare />
            <div className="ml-2 flex-none text-sm font-medium uppercase md:hidden lg:block">
              {siteName}
            </div>
          </Link>

          {navItems.length ? (
            <ul className="hidden gap-6 text-sm md:flex md:items-center">
              {navItems.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.path}
                    prefetch={true}
                    className={linkClass(item.path)}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="hidden justify-center md:flex md:w-1/3">
          <Suspense fallback={<SearchSkeleton />}>
            <Search />
          </Suspense>
        </div>

        <div className="flex justify-end md:w-1/3" />
      </div>
    </nav>
  );
}

