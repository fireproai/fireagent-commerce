"use client";

import React from "react";

type MobileFiltersProps = {
  buttonLabel?: string;
  title?: string;
  children: React.ReactNode;
};

export function MobileFilters({ buttonLabel = "Filters", title = "Filters", children }: MobileFiltersProps) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKeyDown);
    }
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open filters"
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:border-neutral-300 hover:bg-neutral-50 md:hidden"
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-x-0 top-0 h-[70vh] rounded-b-2xl bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-900">{title}</div>
              <button
                type="button"
                aria-label="Close filters"
                className="rounded-md border border-neutral-200 px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[calc(70vh-3rem)] overflow-auto">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
