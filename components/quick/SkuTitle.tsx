import React from "react";

import { splitTitleOnFirstDot } from "@/lib/text/splitTitleOnFirstDot";

type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, { headline: string; subline: string }> = {
  sm: { headline: "text-sm", subline: "text-xs" },
  md: { headline: "text-base", subline: "text-sm" },
  lg: { headline: "text-lg", subline: "text-sm" },
};

type Props = {
  sku: string;
  title?: string | null;
  size?: Size;
  className?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function SkuTitle({ sku, title, size = "md", className }: Props) {
  const { head, tail } = splitTitleOnFirstDot(title);
  const sizes = sizeMap[size] || sizeMap.md;

  return (
    <div className={cx("min-w-0 space-y-1", className)}>
      <div className={cx("grid min-w-0 grid-cols-[140px_1fr] items-baseline gap-2 font-semibold text-neutral-900", sizes.headline)}>
        <span className="truncate tabular-nums text-neutral-900">{sku}</span>
        <span className="truncate text-neutral-900">{head || title || sku}</span>
      </div>
      {tail ? (
        <div className={cx("truncate text-neutral-600", sizes.subline)} title={tail}>
          {tail}
        </div>
      ) : null}
    </div>
  );
}
