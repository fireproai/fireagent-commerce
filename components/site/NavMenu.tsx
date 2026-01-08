"use client";

import { slugify } from "lib/plytix/slug";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type NavGroup = {
  name: string;
  items: string[];
};

export type NavRoot = {
  name: string;
  groups: NavGroup[];
};

export default function NavMenu({ tree }: { tree: NavRoot[] }) {
  const [openRoot, setOpenRoot] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const navWithSlugs = useMemo(
    () =>
      tree.map((root) => {
        const rootSlug = slugify(root.name);
        return {
          ...root,
          slug: rootSlug,
          groups: root.groups.map((group) => {
            const groupSlug = slugify(group.name);
            return {
              ...group,
              slug: groupSlug,
              items: group.items.map((item) => ({
                label: item,
                slug: slugify(item),
              })),
            };
          }),
        };
      }),
    [tree]
  );

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setOpenRoot(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  const toggleRoot = (slug: string) => {
    setOpenRoot((current) => (current === slug ? null : slug));
  };

  if (!navWithSlugs.length) return null;

  return (
    <nav className="flex h-9 items-center gap-1" ref={menuRef}>
      {navWithSlugs.map((root) => (
        <div key={root.slug} className="relative">
          <button
            type="button"
            onClick={() => toggleRoot(root.slug)}
            aria-expanded={openRoot === root.slug}
            className={[
              "inline-flex h-9 items-center rounded-md px-3 text-sm leading-none transition-colors",
              "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
            ].join(" ")}
          >
            <span className="inline-flex items-center gap-1">
              {root.name}
              <span className="text-neutral-400" aria-hidden>
                ▾
              </span>
            </span>
          </button>

          {openRoot === root.slug ? (
            <div className="absolute left-0 top-full z-10 mt-2 min-w-[260px] rounded-lg border border-neutral-200 bg-white shadow-lg">
              <div className="space-y-1 p-2">
                <Link
                  href={`/products/${root.slug}`}
                  onClick={() => setOpenRoot(null)}
                  className="block rounded-md px-2 py-1 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  View all {root.name}
                </Link>

                {root.groups.map((group) => (
                  <div
                    key={`${root.slug}-${group.slug}`}
                    className="rounded-md px-2 py-1 hover:bg-neutral-50"
                  >
                    <Link
                      href={`/products/${root.slug}/${group.slug}`}
                      onClick={() => setOpenRoot(null)}
                      className="text-sm font-medium text-neutral-900 hover:text-neutral-900"
                    >
                      {group.name}
                    </Link>

                    {group.items.length > 0 ? (
                      <div className="mt-1 space-y-1 pl-3 text-sm text-neutral-600">
                        {group.items.map((item) => (
                          <Link
                            key={`${group.slug}-${item.slug}`}
                            href={`/products/${root.slug}/${group.slug}/${item.slug}`}
                            onClick={() => setOpenRoot(null)}
                            className="block hover:text-neutral-900"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
