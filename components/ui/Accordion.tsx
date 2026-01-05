"use client";

import React, { useState } from "react";

type AccordionItem = {
  id: string;
  label: string;
  content: React.ReactNode;
};

type AccordionProps = {
  items: AccordionItem[];
  className?: string;
};

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Accordion({ items, className }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white",
        className,
      )}
    >
      {items.map((item) => {
        const isOpen = item.id === openId;
        return (
          <div key={item.id} className="bg-white">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-neutral-900"
            >
              <span>{item.label}</span>
              <span aria-hidden="true" className="text-neutral-500">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen ? (
              <div className="border-t border-neutral-200 px-4 py-3 text-sm text-neutral-700">
                {item.content}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
