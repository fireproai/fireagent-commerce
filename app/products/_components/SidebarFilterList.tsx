"use client";

import Link from "next/link";
import React from "react";

type Item = {
  label: string;
  slug: string;
  href: string;
  count: number;
  selected?: boolean;
};

type Props = {
  items: Item[];
  title?: string;
  placeholder?: string;
  variant?: "framed" | "plain";
};

export function SidebarFilterList({
  items,
  title = "Filters",
  placeholder = "Filter groups…",
  variant = "framed",
}: Props) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  const showSearch = items.length >= 8;

  return (
    <div className={variant === "framed" ? "rounded-lg border border-neutral-200 bg-white shadow-sm" : ""}>
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-3 py-2">
        <div className="text-sm font-semibold text-neutral-800">{title}</div>
        {showSearch ? (
          <div className="mt-2">
            <label className="sr-only" htmlFor="sidebar-filter-search">
              {placeholder}
            </label>
            <input
              id="sidebar-filter-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />
          </div>
        ) : null}
      </div>
      <div className="divide-y divide-neutral-200">
        {filtered.map((item) => (
          <Link
            key={item.slug}
            href={item.href}
            className={`flex items-center justify-between px-3 py-1.5 text-[13px] transition ${
              item.selected
                ? "border border-l-2 border-neutral-200 border-l-red-700 bg-neutral-50 font-medium text-neutral-900"
                : "text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <span className="truncate">{item.label}</span>
            <span className="text-[11px] text-neutral-400">{item.count}</span>
          </Link>
        ))}
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-neutral-500">No matches</div>
        ) : null}
      </div>
    </div>
  );
}
