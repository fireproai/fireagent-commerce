"use client";

import clsx from "clsx";
import React from "react";

type Tab = {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
};

type TabsFrameProps = {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
  variant?: "default" | "wide";
  actions?: React.ReactNode;
};

export function TabsFrame({
  tabs,
  activeTab,
  onTabChange,
  className,
  variant = "default",
  actions,
}: TabsFrameProps) {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const focusTabByIndex = (index: number) => {
    const safeIndex = (index + tabs.length) % tabs.length;
    const target = tabRefs.current[safeIndex];
    if (target) target.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number, tabId: string) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusTabByIndex(index + 1);
        return;
      case "ArrowLeft":
        event.preventDefault();
        focusTabByIndex(index - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        onTabChange(tabId);
        return;
      default:
        return;
    }
  };

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={clsx("w-full rounded-2xl border border-neutral-200 bg-white shadow-sm", className)}>
      <div
        role="tablist"
        aria-label="Tabs"
        className={clsx(
          "relative flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200",
          variant === "wide" ? "px-3 pt-2" : "px-4 pt-3"
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTab;
            const tabId = `${tab.id}-tab`;
            const panelId = `${tab.id}-panel`;
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={tabId}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(event) => handleKeyDown(event, index, tab.id)}
                className={clsx(
                  "relative w-full flex-1 rounded-t-lg px-3 py-2 text-center text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  isActive
                    ? "z-[1] -mb-px border border-neutral-200 border-b-white bg-white text-neutral-900"
                    : "border border-transparent bg-neutral-50 text-neutral-700 hover:border-neutral-200 hover:bg-[var(--hover-surface)] hover:text-neutral-900"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div
        role="tabpanel"
        id={`${activeTab}-panel`}
        aria-labelledby={`${activeTab}-tab`}
        className={clsx(
          "bg-white",
          variant === "wide" ? "px-3 pb-3 pt-2" : "px-4 pb-4 pt-3"
        )}
      >
        {activeTabContent}
      </div>
    </div>
  );
}
