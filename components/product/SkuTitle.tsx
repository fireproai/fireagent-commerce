import Link from "next/link";
import React from "react";

import { formatSkuTitle } from "lib/formatSkuTitle";

type Size = "sm" | "md";
type Variant = "grid" | "list";

type Props = {
  sku: string;
  title?: string | null;
  href?: string;
  size?: Size;
  variant?: Variant;
  className?: string;
  showHeadline?: boolean;
  showSubline?: boolean;
  showSkuPrefix?: boolean;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const headlineClasses: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
};

const sublineClasses: Record<Size, string> = {
  sm: "text-xs",
  md: "text-sm",
};

export function SkuTitle({
  sku,
  title,
  href,
  size = "sm",
  variant = "list",
  className = "",
  showHeadline = true,
  showSubline = true,
  showSkuPrefix = true,
}: Props) {
  const { headline, subline } = formatSkuTitle(sku, title);
  const isGrid = variant === "grid";
  const headlineText =
    !showSkuPrefix && headline?.startsWith(`${sku} — `) ? headline.replace(`${sku} — `, "").trimStart() : headline;

  const headlineClass = cn(
    "min-w-0 font-semibold text-neutral-900",
    headlineClasses[size],
    isGrid ? "whitespace-normal break-words" : "truncate"
  );

  const sublineClass = cn(
    "min-w-0 whitespace-normal break-words leading-snug text-neutral-600",
    sublineClasses[size]
  );

  const content = (
    <>
      {showHeadline && headlineText ? (
        <div className={headlineClass} title={!isGrid ? headlineText : undefined}>
          {headlineText}
        </div>
      ) : null}
      {showSubline && subline ? <div className={sublineClass}>{subline}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "group block min-w-0 space-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          className
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn("min-w-0 space-y-1", className)}>{content}</div>;
}
