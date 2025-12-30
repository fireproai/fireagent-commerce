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

type Section = { title: string; items: Item[]; placeholder?: string };

type Props = {
  items?: Item[];
  sections?: Section[];
  backHrefs?: Array<string | undefined>;
  currentLevel?: number;
  title?: string;
  placeholder?: string;
  variant?: "framed" | "plain";
};

export function SidebarFilterList({
  items = [],
  sections,
  backHrefs = [],
  currentLevel,
  title = "Filters",
  placeholder = "Filter groups",
  variant = "framed",
}: Props) {
  const [queries, setQueries] = React.useState<Record<string, string>>({});

  const resolvedSections =
    sections && sections.length
      ? sections
      : [
          {
            title,
            items,
            placeholder,
          },
        ];

  const deepestSelectedIndex = React.useMemo(() => {
    const lastSelected = resolvedSections
      .map((section) => section.items.some((item) => item.selected))
      .lastIndexOf(true);
    return lastSelected >= 0 ? lastSelected : 0;
  }, [resolvedSections]);

  const currentIndex =
    typeof currentLevel === "number" ? Math.max(0, Math.min(currentLevel, resolvedSections.length - 1)) : deepestSelectedIndex;
  const currentSection = resolvedSections[currentIndex];

  const queryKey = `${currentSection.title}-${currentIndex}`;
  const query = queries[queryKey] ?? "";
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currentSection.items;
    return currentSection.items.filter((item) => item.label.toLowerCase().includes(q));
  }, [currentSection.items, query]);

  const showSearch = currentSection.items.length >= 8;
  const inputId = `sidebar-filter-search-${queryKey.replace(/\s+/g, "-").toLowerCase()}`;
  const backHref = currentIndex > 0 ? backHrefs[currentIndex] : undefined;

  return (
    <div className={variant === "framed" ? "rounded-lg border border-neutral-200 bg-white shadow-sm" : ""}>
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-3 py-2">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-neutral-700 hover:text-neutral-900"
          >
            <span aria-hidden="true">{"<-"}</span>
            Back
          </Link>
        ) : null}
        <div className="text-sm font-semibold text-neutral-800">{currentSection.title}</div>
        {showSearch ? (
          <div className="mt-2">
            <label className="sr-only" htmlFor={inputId}>
              {currentSection.placeholder || placeholder}
            </label>
            <input
              id={inputId}
              type="search"
              value={query}
              onChange={(e) => setQueries((prev) => ({ ...prev, [queryKey]: e.target.value }))}
              placeholder={currentSection.placeholder || placeholder}
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
