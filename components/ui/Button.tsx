import React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50",
  secondary: "border border-neutral-200 text-neutral-900 hover:bg-neutral-50 disabled:opacity-50",
  ghost: "text-neutral-700 hover:bg-neutral-50 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export function Button({ variant = "primary", size = "md", fullWidth = false, className = "", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-neutral-500 disabled:cursor-not-allowed";
  const width = fullWidth ? "w-full" : "";
  return (
    <button className={cn(base, variantClasses[variant], sizeClasses[size], width, className)} {...props} />
  );
}
