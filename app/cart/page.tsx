"use client";

import Link from "next/link";
import { useCart } from "components/cart/cart-context";

export default function CartPage() {
  const { cart, updateCartItem } = useCart();
  const lines = cart?.lines || [];
  const subtotal = cart?.cost?.totalAmount?.amount || "0";
  const currency = cart?.cost?.totalAmount?.currencyCode || "USD";
  const checkoutUrl = cart?.checkoutUrl || "";
  const formatMoney = (amount?: string, code?: string) => {
    if (!amount || !code) return null;
    const numeric = Number(amount);
    if (Number.isNaN(numeric)) return null;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric);
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Cart</h1>

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          Your cart is empty.
        </p>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3">
            {lines.map((line, idx) => (
              <li
                key={line.merchandise?.id || line.id || idx}
                className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-black"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                      {line.merchandise?.product?.title || "Item"}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {line.merchandise?.product?.handle || line.merchandise?.title}
                    </div>
                    {line.merchandise?.selectedOptions?.length ? (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {line.merchandise.selectedOptions.map((opt) => `${opt.name}: ${opt.value}`).join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right space-y-1">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700"
                        onClick={() => updateCartItem(line.merchandise.id, "minus")}
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="text-sm text-neutral-700 dark:text-neutral-200">{line.quantity}</span>
                      <button
                        type="button"
                        className="rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700"
                        onClick={() => updateCartItem(line.merchandise.id, "plus")}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                      {formatMoney(
                        line.cost?.totalAmount?.amount,
                        line.cost?.totalAmount?.currencyCode
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
            <div className="text-sm text-neutral-600 dark:text-neutral-300">Subtotal (ex VAT)</div>
            <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {formatMoney(subtotal, currency)}
            </div>
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            VAT calculated at checkout.
          </div>

          {checkoutUrl ? (
            <a
              href={checkoutUrl}
              className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Checkout
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex w-full items-center justify-center rounded-lg bg-neutral-300 px-4 py-3 text-sm font-semibold text-neutral-600"
            >
              Checkout unavailable
            </button>
          )}

          <Link href="/products" className="block text-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            Continue shopping
          </Link>
        </div>
      )}
    </section>
  );
}
