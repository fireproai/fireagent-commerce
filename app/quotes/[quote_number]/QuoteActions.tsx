"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useCart } from "components/cart/cart-context";
import { sendQuote } from "lib/client/sendQuote";
import { MONEY_FALLBACK_CURRENCY } from "lib/money";

type Props = {
  quoteNumber: string;
  email: string;
  issuedAt?: Date | string | null;
  quoteLines: Array<{
    sku: string;
    name?: string | null;
    qty: number;
    unit_price_ex_vat?: number | null;
  }>;
  fromQuoteHref?: string | null;
};

function formatDate(value?: Date | string | null) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

const getCartLinesArray = (cart: any): any[] => {
  if (!cart || !cart.lines) return [];
  if (Array.isArray(cart.lines)) return cart.lines;
  if (Array.isArray((cart.lines as any).nodes)) return (cart.lines as any).nodes;
  if (Array.isArray((cart.lines as any).edges)) {
    return (cart.lines as any).edges.map((e: any) => e?.node).filter(Boolean);
  }
  return [];
};

export function QuoteActions({ quoteNumber, email, issuedAt, quoteLines, fromQuoteHref }: Props) {
  const router = useRouter();
  const { cart, applyCartLines } = useCart();
  const [sending, setSending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showCartPrompt, setShowCartPrompt] = useState(false);
  const [pendingLines, setPendingLines] = useState<Array<{ variant: any; product: any; quantity: number }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cartLinesArray = useMemo(() => getCartLinesArray(cart), [cart]);
  const cartLineCount = useMemo(
    () => cartLinesArray.reduce((sum, line) => sum + Number(line?.quantity ?? 0), 0),
    [cartLinesArray]
  );

  const findMatchingCartLine = (sku: string) => {
    const target = sku.toLowerCase();
    return cartLinesArray.find((line: any) => {
      const merchTitle = String(line?.merchandise?.title || "").toLowerCase();
      const merchHandle = String(line?.merchandise?.product?.handle || line?.handle || "").toLowerCase();
      const explicitSku = String((line as any)?.sku || "").toLowerCase();
      return merchTitle === target || merchHandle === target || explicitSku === target;
    });
  };

  const handleAddToCart = async () => {
    setError(null);
    setAdding(true);
    try {
      const normalized = quoteLines
        .map((line) => ({
          sku: String(line.sku || "").trim(),
          name: line.name || line.sku,
          qty: Math.max(0, Math.floor(Number(line.qty ?? 0))),
          unit_price_ex_vat: Number.isFinite(Number(line.unit_price_ex_vat))
            ? Number(line.unit_price_ex_vat)
            : 0,
        }))
        .filter((line) => line.sku && line.qty > 0);

      if (!normalized.length) {
        toast.error("No lines to add from this quote.");
        return;
      }

      const transferLines = normalized.map((line) => {
        const existing = findMatchingCartLine(line.sku);
        const variantId = existing?.merchandise?.id || existing?.merchandiseId || existing?.id || line.sku;
        const productHandle = existing?.merchandise?.product?.handle || existing?.handle || line.sku;
        const productTitle = existing?.merchandise?.product?.title || existing?.title || line.name || line.sku;
        const unitPrice = Number.isFinite(line.unit_price_ex_vat) ? Number(line.unit_price_ex_vat) : 0;
        const variant = {
          id: variantId,
          title: line.sku,
          availableForSale: true,
          selectedOptions: [],
          price: {
            amount: unitPrice.toString(),
            currencyCode: existing?.cost?.totalAmount?.currencyCode || MONEY_FALLBACK_CURRENCY,
          },
        } as any;
        const product = {
          id: productHandle,
          handle: productHandle,
          title: productTitle,
          featuredImage: null,
          variants: [],
        } as any;
        return { variant, product, quantity: line.qty };
      });

      if (cartLineCount > 0) {
        setPendingLines(transferLines);
        setShowCartPrompt(true);
        return;
      }

      applyCartLines(transferLines, "merge");
      const totalQty = normalized.reduce((sum, line) => sum + line.qty, 0);
      toast.success(`Added ${totalQty} item${totalQty === 1 ? "" : "s"} to cart`, {
        action: {
          label: "View cart",
          onClick: () => router.push("/quick-cart?tab=cart"),
        },
      });
    } catch (err) {
      const message = (err as Error)?.message || "Failed to add quote to cart";
      setError(message);
      toast.error(message);
    } finally {
      setAdding(false);
    }
  };

  const handleApplyPendingLines = (mode: "merge" | "replace") => {
    if (!pendingLines?.length) {
      setShowCartPrompt(false);
      return;
    }
    applyCartLines(pendingLines, mode);
    const totalQty = pendingLines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
    toast.success(`Added ${totalQty} item${totalQty === 1 ? "" : "s"} to cart`, {
      action: {
        label: "View cart",
        onClick: () => router.push("/quick-cart?tab=cart"),
      },
    });
    setPendingLines(null);
    setShowCartPrompt(false);
  };

  const handleSend = async () => {
    setError(null);
    setSending(true);
    try {
      await sendQuote({ quoteNumber, email });
      toast.success(`Quote ${quoteNumber} emailed`);
      router.refresh();
    } catch (err) {
      const message = (err as Error)?.message || "Failed to send quote";
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const issuedText = formatDate(issuedAt);
  const buttonBase =
    "inline-flex min-w-[170px] items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold shadow-sm";

  return (
    <div className="flex flex-col items-end gap-2">
      {fromQuoteHref ? (
        <Link
          href={fromQuoteHref}
          className={`${buttonBase} border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100`}
        >
          View / edit quote
        </Link>
      ) : null}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={adding}
        className={`${buttonBase} border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 disabled:opacity-60`}
      >
        {adding ? "Adding..." : "Add quote to basket"}
      </button>
      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        className={`${buttonBase} bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-60`}
      >
        {sending ? "Sending..." : "Send quote"}
      </button>
      {issuedText ? <p className="text-xs text-neutral-600">Issued {issuedText}</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {showCartPrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
            <p className="text-base font-semibold text-neutral-900">Add quote to basket?</p>
            <p className="mt-1 text-sm text-neutral-700">
              Your basket already has items. What would you like to do?
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-end">
              <button
                type="button"
                className={`${buttonBase} w-full sm:w-auto sm:flex-1 bg-neutral-900 text-white hover:bg-neutral-800`}
                onClick={() => handleApplyPendingLines("merge")}
              >
                <span className="flex w-full flex-col items-center leading-tight">
                  <span>Merge</span>
                  <span className="text-[11px] font-normal text-neutral-200">Recommended</span>
                </span>
              </button>
              <button
                type="button"
                className={`${buttonBase} w-full sm:w-auto sm:flex-1 border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100`}
                onClick={() => handleApplyPendingLines("replace")}
              >
                Replace
              </button>
              <button
                type="button"
                className={`${buttonBase} w-full sm:w-auto sm:flex-1 border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100`}
                onClick={() => {
                  setShowCartPrompt(false);
                  setPendingLines(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
