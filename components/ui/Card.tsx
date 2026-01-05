import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-2xl border border-neutral-100 bg-white shadow-sm ${className}`.trim()}>{children}</div>
  );
}

export function CardContent({ children, className = "" }: CardProps) {
  return <div className={`px-5 pb-5 ${className}`.trim()}>{children}</div>;
}

export function CardHeader({ children, className = "" }: CardProps) {
  return <div className={`px-5 pt-5 ${className}`.trim()}>{children}</div>;
}
