"use client";

import React, { useState } from "react";

type Tab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

type TabsProps = {
  tabs: Tab[];
  className?: string;
};

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Tabs({ tabs, className }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium border-b-2",
                isActive
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-600 hover:text-neutral-900",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab ? <div className="pt-4 text-sm text-neutral-700">{activeTab.content}</div> : null}
    </div>
  );
}
