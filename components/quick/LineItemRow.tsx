"use client";

import Link from "next/link";

import { Button } from "components/ui/Button";

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

export function LineItemRow({
  sku,
  name,
  qty,
  unitDisplay,
  totalDisplay,
  href = `/product/sku/${encodeURIComponent(sku)}`,
  onQtyChange,
  onIncrement,
  onDecrement,
  onRemove,
}: LineItemRowProps) {
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={href} className="text-sm font-semibold text-neutral-900 hover:underline">
          {sku}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            max={999}
            value={qty}
            onChange={(e) => onQtyChange(Number(e.currentTarget.value))}
            className="w-24 rounded-md border border-neutral-200 px-2 py-1 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
          />
          <div className="flex items-center rounded-md border border-neutral-200">
            <button
              type="button"
              className="px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
              onClick={onDecrement}
            >
              -
            </button>
            <button
              type="button"
              className="px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
              onClick={onIncrement}
            >
              +
            </button>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="w-28 text-right text-sm font-medium text-neutral-900">{unitDisplay}</span>
          <span className="w-28 text-right text-sm font-semibold text-neutral-900">{totalDisplay}</span>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
      <Link href={href} className="mt-1 block text-xs text-neutral-600 hover:underline">
        {name}
      </Link>
    </div>
  );
}
