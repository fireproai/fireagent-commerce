import React from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function Container({ children, className = "" }: Props) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`.trim()}>{children}</div>;
}
