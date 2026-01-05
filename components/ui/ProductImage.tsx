import React from "react";

type Props = {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function ProductImage({ src, alt = "", size = "md", className = "" }: Props) {
  const sizeClass =
    size === "sm"
      ? "w-14 h-full"
      : size === "lg"
        ? "w-64 aspect-square"
        : "w-40 aspect-square";
  return (
    <div className={`overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 ${sizeClass} ${className}`.trim()}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-8 w-8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5V8.25M21 16.5V8.25M6 19.5h12M9.75 7.5h4.5m-9 4.5h13.5"
            />
          </svg>
          {size !== "sm" ? <p className="text-xs font-medium">Image coming soon</p> : null}
        </div>
      )}
    </div>
  );
}
