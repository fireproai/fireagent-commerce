import React from "react";

type Props = {
  title: string;
  description?: string;
  className?: string;
};

export function SectionHeading({ title, description, className = "" }: Props) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      {description ? <p className="text-sm text-neutral-600">{description}</p> : null}
    </div>
  );
}
