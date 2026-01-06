"use client";

import Link from "next/link";
import React from "react";
import { Dialog, Transition } from "@headlessui/react";

import { Button } from "components/ui/Button";
import { formatLineTitle } from "lib/formatLineTitle";

export const LINE_ITEM_GRID_TEMPLATE =
  "grid-cols-[minmax(0,1fr)_96px_120px_132px_72px]";

type LineItemRowProps = {
  sku: string;
  name: string;
  qty: number;
  unitDisplay: string;
  totalDisplay: string;
  href?: string;
  onQtyChange: (nextQty: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

function clampQty(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(9999, Math.trunc(n)));
}

export function LineItemRow({
  sku,
  name,
  qty,
  unitDisplay,
  totalDisplay,
  href = `/product/sku/${encodeURIComponent(sku)}`,
  onQtyChange,
  onIncrement: _onIncrement,
  onDecrement: _onDecrement,
  onRemove,
}: LineItemRowProps) {
  const [showConfirm, setShowConfirm] = React.useState(false);

  const { line1: primaryTitle, line2: secondaryTitle } = formatLineTitle(name);
  const hasDelimiter = name.includes(".") || name.includes(",");
  const hasSecondary = hasDelimiter && Boolean(secondaryTitle);

  return (
    <div
      className={`grid ${LINE_ITEM_GRID_TEMPLATE} items-start gap-3 px-3 py-2`}
    >
      <div className="min-w-0 space-y-1 leading-snug">
        <div className="grid min-w-0 grid-cols-[minmax(96px,auto)_minmax(0,1fr)] items-baseline gap-x-3">
          <Link
            href={href}
            className="flex-shrink-0 truncate text-sm font-semibold text-neutral-900 hover:underline"
          >
            {sku}
          </Link>
          <Link
            href={href}
            className="min-w-0 truncate text-sm font-semibold text-neutral-900 hover:underline"
          >
            {primaryTitle}
          </Link>
        </div>
        {hasSecondary ? (
          <div className="grid min-w-0 grid-cols-[minmax(96px,auto)_minmax(0,1fr)] items-start gap-x-3">
            <span aria-hidden="true" />
            <Link
              href={href}
              className="block min-w-0 break-words text-xs text-neutral-600 hover:underline"
            >
              {secondaryTitle}
            </Link>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-1">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          min={0}
          max={9999}
          value={String(qty)}
          onChange={(e) => {
            const raw = e.currentTarget.value.replace(/[^\d]/g, "");
            const next = raw === "" ? 0 : Number(raw);
            onQtyChange(clampQty(next));
          }}
          className="w-16 rounded-md border border-neutral-200 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
          aria-label={`Quantity for ${sku}`}
        />
      </div>

      <div className="text-right text-sm font-medium text-neutral-900 tabular-nums whitespace-nowrap">
        {unitDisplay}
      </div>
      <div className="text-right text-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
        {totalDisplay}
      </div>

      <div className="justify-self-end">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[36px] min-w-[36px] justify-center px-2 text-sm font-semibold text-neutral-700 hover:bg-red-50 hover:text-red-600 focus-visible:bg-red-50 focus-visible:text-red-600"
          onClick={() => setShowConfirm(true)}
          aria-label="Remove"
          title="Remove"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M6.75 7.5h10.5"></path>
            <path d="M10 11.25v5"></path>
            <path d="M14 11.25v5"></path>
            <path d="M9 7.5V6.75c0-.69.56-1.25 1.25-1.25h3.5c.69 0 1.25.56 1.25 1.25V7.5"></path>
            <path d="M5.5 7.5h13l-.6 9.02c-.09 1.32-1.18 2.35-2.5 2.35H8.6c-1.32 0-2.41-1.03-2.5-2.35L5.5 7.5Z"></path>
          </svg>
        </Button>
      </div>

      <Transition show={showConfirm} as={React.Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowConfirm(false)}
        >
          <Transition.Child
            as={React.Fragment}
            enter="transition-opacity duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/20" />
          </Transition.Child>

          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <Transition.Child
              as={React.Fragment}
              enter="transition-transform duration-150 ease-out"
              enterFrom="scale-95 opacity-0"
              enterTo="scale-100 opacity-100"
              leave="transition-transform duration-150 ease-in"
              leaveFrom="scale-100 opacity-100"
              leaveTo="scale-95 opacity-0"
            >
              <Dialog.Panel className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-4 shadow-lg">
                <Dialog.Title className="text-base font-semibold text-neutral-900">
                  Remove item?
                </Dialog.Title>
                <div className="mt-2 space-y-1 text-sm text-neutral-700">
                  <p>You're about to remove "{sku}" from this cart.</p>
                  <p className="text-neutral-600">This action can't be undone.</p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-3"
                    type="button"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-red-600 px-3 hover:bg-red-700 focus-visible:ring-red-200"
                    type="button"
                    onClick={() => {
                      setShowConfirm(false);
                      onRemove();
                    }}
                  >
                    Remove item
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
