"use client";

import { Dialog, Transition } from "@headlessui/react";
import Link from "next/link";
import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";

import { sendQuote } from "lib/client/sendQuote";
import { MONEY_FALLBACK_CURRENCY, formatMoney } from "lib/money";
import { LINE_ITEM_GRID_TEMPLATE, LineItemRow } from "components/quick/LineItemRow";
import { Button } from "components/ui/Button";
import { Card, CardContent, CardHeader } from "components/ui/Card";
import { useCart } from "components/cart/cart-context";
import { TabsFrame } from "components/ui/TabsFrame";
import type { QuickBuilderProduct } from "lib/quick/products";
import { CataloguePicker } from "../quick-cart/CataloguePicker";

export type QuickQuoteTab = "quote" | "catalogue" | "summary" | "quotes";

type QuoteLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
};

type QuoteSummary = {
  id: string;
  quote_number: string;
  status: string;
  created_at: string;
  issued_at: string | null;
  total_value: number;
  currency: string;
  publicToken: string | null;
  publicTokenExpiresAt: string | null;
  revision?: number | null;
};

type AppliedLine = {
  sku: string;
  name: string;
  qty: number;
  unit_price_ex_vat: number;
  product?: QuickBuilderProduct;
};

type Props = {
  products: QuickBuilderProduct[];
  initialQuotes: QuoteSummary[];
  isLoggedIn: boolean;
  initialTab: QuickQuoteTab;
  storeCurrency: string;
  initialFromQuote?: string | null;
  initialFromQuoteToken?: string | null;
  initialFromQuoteEmail?: string | null;
};

const DRAFT_STORAGE_KEY = "fa_quote_draft_v1";
const getCartLinesArray = (cart: any): any[] => {
  if (!cart || !cart.lines) return [];
  if (Array.isArray(cart.lines)) return cart.lines;
  if (Array.isArray((cart.lines as any).nodes)) return (cart.lines as any).nodes;
  if (Array.isArray((cart.lines as any).edges)) {
    return (cart.lines as any).edges.map((e: any) => e?.node).filter(Boolean);
  }
  return [];
};

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function round2(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

function buildSnapshotString(payload: {
  email: string;
  company: string;
  reference: string;
  notes: string;
  lines: QuoteLine[];
}) {
  const linesPayload = payload.lines
    .filter((line) => line.qty > 0)
    .map((line) => ({
      sku: line.sku,
      name: line.name,
      qty: line.qty,
      unit_price_ex_vat: round2(line.unit_price_ex_vat),
    }))
    .sort((a, b) => {
      const skuCmp = a.sku.localeCompare(b.sku);
      if (skuCmp !== 0) return skuCmp;
      return a.name.localeCompare(b.name);
    });
  return JSON.stringify({
    email: payload.email.trim(),
    company: payload.company.trim(),
    reference: payload.reference.trim(),
    notes: payload.notes.trim(),
    lines: linesPayload,
  });
}

function normalizeTab(tab?: string | null): QuickQuoteTab {
  if (tab === "quote" || tab === "summary" || tab === "quotes") return tab;
  return "catalogue";
}

export function QuickQuoteClient({
  products,
  initialQuotes,
  isLoggedIn,
  initialTab,
  storeCurrency,
  initialFromQuote,
  initialFromQuoteToken,
  initialFromQuoteEmail,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { cart, applyCartLines } = useCart();
  const baseCurrency = storeCurrency || MONEY_FALLBACK_CURRENCY;
  const lineGridBase = `grid ${LINE_ITEM_GRID_TEMPLATE} items-start gap-x-3 gap-y-2`;
  const lineHeaderClass = `${lineGridBase} border-b border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-800`;
  const totalsRowClass = `${lineGridBase} border-t border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700`;

  const [quoteLines, setQuoteLines] = React.useState<QuoteLine[]>([]);
  const [quoteEmail, setQuoteEmail] = React.useState("");
  const [quoteCompany, setQuoteCompany] = React.useState("");
  const [quoteReference, setQuoteReference] = React.useState("");
  const [quoteNotes, setQuoteNotes] = React.useState("");
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = React.useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [quoteAction, setQuoteAction] = React.useState<"save" | "send" | null>(null);
  const [lastSentEmail, setLastSentEmail] = React.useState<string | null>(null);
  const [sendModalLoading, setSendModalLoading] = React.useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = React.useState<string | null>(null);
  const [lastSavedQuoteNumber, setLastSavedQuoteNumber] = React.useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [privacyChecked, setPrivacyChecked] = React.useState(false);
  const [privacyError, setPrivacyError] = React.useState<string | null>(null);
  const [loggedIn, setLoggedIn] = React.useState(isLoggedIn);
  const [quotes, setQuotes] = React.useState<QuoteSummary[]>(initialQuotes);
  const [activeTab, setActiveTab] = React.useState<QuickQuoteTab>(initialTab);
  const [mounted, setMounted] = React.useState(false);
  const cartLinesArray = React.useMemo(() => getCartLinesArray(cart), [cart]);
  const cartLineCount = React.useMemo(
    () => cartLinesArray.reduce((sum, line) => sum + Number(line?.quantity ?? 0), 0),
    [cartLinesArray]
  );
  const cartCurrency = React.useMemo(
    () => cartLinesArray[0]?.cost?.totalAmount?.currencyCode || baseCurrency,
    [cartLinesArray, baseCurrency]
  );
  const currencyCode = cartCurrency;
  const [showTransferModal, setShowTransferModal] = React.useState(false);
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"cancel" | "new" | null>(null);
  const [actionCompleted, setActionCompleted] = React.useState(false);
  const actionCompleteTimer = React.useRef<NodeJS.Timeout | null>(null);
  const [showSendModal, setShowSendModal] = React.useState(false);
  const [sendModalEmail, setSendModalEmail] = React.useState("");
  const [sendModalError, setSendModalError] = React.useState<string | null>(null);
  const dirtyToastTimer = React.useRef<NodeJS.Timeout | null>(null);
  const dirtyToastShown = React.useRef(false);
  const [fromQuoteLoading, setFromQuoteLoading] = React.useState(false);
  const [fromQuoteError, setFromQuoteError] = React.useState<string | null>(null);
  const [editingFromQuote, setEditingFromQuote] = React.useState<string | null>(initialFromQuote || null);
  const [focusSearchPending, setFocusSearchPending] = React.useState(false);
  const hydratedFromQuoteKey = React.useRef<string | null>(null);
  const [editingRevision, setEditingRevision] = React.useState<number | null>(null);
  const [fromQuoteLoadedAt, setFromQuoteLoadedAt] = React.useState<number | null>(null);
  const [fromQuoteCleared, setFromQuoteCleared] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);

  React.useEffect(() => {
    setLoggedIn(isLoggedIn);
  }, [isLoggedIn]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const cookies = document.cookie || "";
    const isAuthed = /_secure_customer_sig|customer_signed_in|customerLoggedIn/i.test(cookies);
    setLoggedIn(isAuthed);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.quoteLines) setQuoteLines(parsed.quoteLines);
      if (parsed?.quoteEmail) setQuoteEmail(parsed.quoteEmail);
      if (parsed?.quoteCompany) setQuoteCompany(parsed.quoteCompany);
      if (parsed?.quoteReference) setQuoteReference(parsed.quoteReference);
      if (parsed?.quoteNotes) setQuoteNotes(parsed.quoteNotes);
      if (typeof parsed?.privacyChecked === "boolean") setPrivacyChecked(parsed.privacyChecked);
      if (parsed?.lastSavedSnapshot) setLastSavedSnapshot(parsed.lastSavedSnapshot);
      if (parsed?.lastSavedQuoteNumber) setLastSavedQuoteNumber(parsed.lastSavedQuoteNumber);
      setDraftLoaded(true);
    } catch {
      // ignore hydration errors
    }
  }, [mounted]);

  React.useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;
    if (!draftLoaded) return;
    const handle = setTimeout(() => {
      try {
        const payload = {
          quoteLines,
          quoteEmail,
          quoteCompany,
          quoteReference,
          quoteNotes,
          privacyChecked,
          lastSavedSnapshot,
          lastSavedQuoteNumber,
        };
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // ignore persistence errors
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [
    mounted,
    draftLoaded,
    quoteLines,
    quoteEmail,
    quoteCompany,
    quoteReference,
    quoteNotes,
    privacyChecked,
    lastSavedSnapshot,
    lastSavedQuoteNumber,
  ]);

  React.useEffect(() => {
    if (!mounted) return;
    // Keep search param sync separate; activeTab omitted from deps to avoid loop
    const paramTab = searchParams?.get("tab");
    if (!paramTab) return;
    const normalized = normalizeTab(paramTab);
    setActiveTab((prev) => (prev === normalized ? prev : normalized));
  }, [mounted, searchParams]);

  const focusCatalogueSearch = React.useCallback(() => {
    if (typeof document === "undefined") return false;
    const input = document.getElementById("catalogue-search") as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select?.();
      return true;
    }
    return false;
  }, []);

  React.useEffect(() => {
    if (!focusSearchPending) return undefined;
    if (activeTab !== "catalogue") return undefined;
    const success = focusCatalogueSearch();
    if (success) {
      setFocusSearchPending(false);
      return undefined;
    }
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => {
      if (focusCatalogueSearch()) setFocusSearchPending(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [focusSearchPending, activeTab, focusCatalogueSearch]);

  React.useEffect(() => {
    if (!fromQuoteLoadedAt) return undefined;
    const timer = setTimeout(() => setFromQuoteLoadedAt(null), 1500);
    return () => clearTimeout(timer);
  }, [fromQuoteLoadedAt]);

  const updateTab = (tab: QuickQuoteTab) => {
    if (!mounted) return;
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const clearDraft = () => {
    setQuoteLines([]);
    setQuoteEmail("");
    setQuoteCompany("");
    setQuoteReference("");
    setQuoteNotes("");
    setLastSentEmail(null);
    setLastSavedSnapshot(null);
    setLastSavedQuoteNumber(null);
    setIsDirty(false);
    setPrivacyChecked(false);
    setPrivacyError(null);
    setEditingFromQuote(null);
    setFromQuoteError(null);
    setFocusSearchPending(false);
    hydratedFromQuoteKey.current = null;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };

  const removeFromQuoteParams = React.useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("from_quote");
    params.delete("token");
    params.delete("e");
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  const clearFromQuote = () => {
    setEditingFromQuote(null);
    setEditingRevision(null);
    setFromQuoteLoading(false);
    setFromQuoteError(null);
    setFromQuoteLoadedAt(null);
    setFocusSearchPending(false);
    setFromQuoteCleared(true);
    hydratedFromQuoteKey.current = null;
    removeFromQuoteParams();
    // Preserve current draft; just exit editing mode.
  };

  const applyCatalogueLines = (lines: AppliedLine[]) => {
    if (!lines.length) return;
    setQuoteLines((prev) => {
      const next = prev.map((item) => ({ ...item }));
      lines.forEach((line) => {
        const unitPrice = Number.isFinite(line.unit_price_ex_vat) ? line.unit_price_ex_vat : 0;
        const idx = next.findIndex((item) => item.sku === line.sku);
        if (idx >= 0) {
          const existing = next[idx];
          if (!existing) return;
          const newQty = Math.min(999, existing.qty + line.qty);
          next[idx] = {
            ...existing,
            qty: newQty,
            unit_price_ex_vat: unitPrice || existing.unit_price_ex_vat,
          };
        } else {
          next.push({
            sku: line.sku,
            name: line.name || line.sku,
            qty: line.qty,
            unit_price_ex_vat: unitPrice,
          });
        }
      });
      return next;
    });
    toast.success(`Added ${lines.length} item(s) to quote`);
  };

  const buildCartTransferLines = React.useCallback(
    () =>
      quoteLines
        .filter((line) => line.qty > 0)
        .map((line) => {
          const product = products.find((item) => item.sku === line.sku);
          const variant = {
            id: product?.merchandiseId ?? line.sku,
            title: line.sku,
            availableForSale: true,
            selectedOptions: [],
            price: {
              amount: (line.unit_price_ex_vat ?? 0).toString(),
              currencyCode,
            },
          } as any;
          const productPayload = {
            id: product?.handle ?? line.sku,
            handle: product?.handle ?? line.sku,
            title: product?.name || line.name || line.sku,
            featuredImage: null,
            variants: [],
          } as any;
          return { variant, product: productPayload, quantity: line.qty };
        }),
    [products, quoteLines, currencyCode]
  );

  const applyQuoteToCart = (mode: "merge" | "replace") => {
    const transferLines = buildCartTransferLines();
    if (!transferLines.length) {
      toast.error("Add items to your quote first.");
      return;
    }
    applyCartLines(transferLines, mode);
    setShowTransferModal(false);
    const totalQty = transferLines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
    toast.success(`Added ${totalQty} item${totalQty === 1 ? "" : "s"} to cart`);
  };

  const handleAddAllToCart = () => {
    const transferLines = buildCartTransferLines();
    if (!transferLines.length) {
      toast.error("Add items to your quote first.");
      return;
    }
    if (cartLineCount > 0) {
      setShowTransferModal(true);
      return;
    }
    applyQuoteToCart("replace");
  };

  const setQuoteQuantity = (sku: string, nextQty: number) => {
    const safeQty = Math.max(0, Math.min(9999, Math.floor(nextQty)));
    setQuoteLines((prev) => {
      if (safeQty === 0) return prev.filter((line) => line.sku !== sku);
      return prev.map((line) => (line.sku === sku ? { ...line, qty: safeQty } : line));
    });
  };

  const removeLine = (sku: string) => {
    setQuoteLines((prev) => prev.filter((line) => line.sku !== sku));
  };

  const buildLinesPayload = () =>
    quoteLines
      .filter((line) => line.qty > 0)
      .map((line) => ({
        sku: line.sku,
        name: line.name,
        qty: line.qty,
        unit_price_ex_vat: round2(line.unit_price_ex_vat),
      }));

  const currentSnapshot = React.useMemo(
    () =>
      buildSnapshotString({
        email: quoteEmail,
        company: quoteCompany,
        reference: quoteReference,
        notes: quoteNotes,
        lines: quoteLines,
      }),
    [quoteEmail, quoteCompany, quoteReference, quoteNotes, quoteLines],
  );

  const hasSavedQuote = Boolean(lastSavedSnapshot) && Boolean(lastSavedQuoteNumber);

  React.useEffect(() => {
    if (!hasSavedQuote) {
      setIsDirty(false);
      return;
    }
    setIsDirty(currentSnapshot !== lastSavedSnapshot);
  }, [currentSnapshot, lastSavedSnapshot, lastSavedQuoteNumber, hasSavedQuote]);

  const saveQuote = async (action: "save" | "send"): Promise<QuoteSummary | null> => {
    setQuoteError(null);
    setQuoteSuccess(null);
    setPrivacyError(null);
    const trimmedEmail = quoteEmail.trim();
    if (!trimmedEmail) {
      setQuoteError("Email is required.");
      return null;
    }
    const linesPayload = buildLinesPayload();
    if (!linesPayload.length) {
      setQuoteError("Add items to the quote first.");
      return null;
    }
    if (!loggedIn && !privacyChecked) {
      setPrivacyError("Please acknowledge the Privacy Policy.");
      return null;
    }

    setQuoteLoading(true);
    setQuoteAction(action);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_number: lastSavedQuoteNumber || undefined,
          email: trimmedEmail,
          company: quoteCompany.trim(),
          reference: quoteReference.trim(),
          notes: quoteNotes.trim(),
          privacy_acknowledged: loggedIn ? true : privacyChecked,
          lines: linesPayload,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data?.message || data?.error || `Quote save failed (HTTP ${res.status})`;
        setQuoteError(message);
        toast.error(message);
        return null;
      }

      const quoteNumber = data?.quote_number;
      if (!quoteNumber) {
        setQuoteError("Quote saved but missing reference. Please check history.");
        toast.error("Quote saved but missing reference. Please check history.");
        return null;
      }

      const totalValueLocal = linesPayload.reduce((sum, line) => sum + line.qty * line.unit_price_ex_vat, 0);
      const returnedQuoteNumber = data?.quote_number || lastSavedQuoteNumber || quoteNumber;
      const newQuote: QuoteSummary = {
        id: data?.id || quoteNumber,
        quote_number: returnedQuoteNumber,
        status: data?.status || "draft",
        created_at: new Date().toISOString(),
        issued_at: data?.issued_at ?? null,
        total_value: Number(totalValueLocal.toFixed(2)),
        currency: baseCurrency,
        publicToken: data?.public_token ?? null,
        publicTokenExpiresAt: data?.public_token_expires_at ?? null,
        revision: data?.revision ?? 0,
      };
      setQuotes((prev) => {
        const existing = prev.filter((quote) => quote.quote_number !== newQuote.quote_number);
        return [newQuote, ...existing];
      });
      setLastSavedSnapshot(currentSnapshot);
      setLastSavedQuoteNumber(returnedQuoteNumber);
      setIsDirty(false);
      if (action === "save") {
        setQuoteSuccess(`Quote ${returnedQuoteNumber} saved`);
        toast.success(`Quote ${returnedQuoteNumber} saved`);
      }
      return newQuote;
    } catch (err) {
      const devMessage =
        process.env.NODE_ENV !== "production"
          ? (err as Error)?.message || "Could not create quote, please try again."
          : "Could not create quote, please try again.";
      setQuoteError(devMessage);
      toast.error(devMessage);
      return null;
    } finally {
      setQuoteLoading(false);
      setQuoteAction(null);
    }
  };

  const handleSaveDraft = async () => {
    await saveQuote("save");
  };

  const handleSendQuote = async (): Promise<boolean> => {
    const trimmedEmail = quoteEmail.trim();
    if (!trimmedEmail) {
      setQuoteError("Enter an email address to send the quote.");
      toast.error("Enter an email address to send the quote.");
      return false;
    }
    const saved = await saveQuote("send");
    if (!saved) return false;
    const quoteNumberToSend = saved.quote_number || lastSavedQuoteNumber;
    if (!quoteNumberToSend) {
      setQuoteError("Quote number unavailable after save.");
      toast.error("Quote number unavailable after save.");
      return false;
    }
    setLastSavedQuoteNumber(quoteNumberToSend);
    setLastSavedSnapshot(currentSnapshot);
    setIsDirty(false);

    setQuoteLoading(true);
    setQuoteAction("send");
    try {
      await sendQuote({ quoteNumber: quoteNumberToSend, email: trimmedEmail });
      const issuedAt = new Date().toISOString();
      const issuedQuote: QuoteSummary = { ...saved, quote_number: quoteNumberToSend, status: "issued", issued_at: issuedAt };
      setQuotes((prev) =>
        prev.map((quote) => (quote.quote_number === quoteNumberToSend ? issuedQuote : quote)),
      );
      toast.success(`Quote ${quoteNumberToSend} emailed.`);
      setQuoteSuccess(`Quote ${quoteNumberToSend} emailed.`);
      setLastSentEmail(trimmedEmail);
      setLastSavedSnapshot(currentSnapshot);
      setIsDirty(false);
      triggerActionCompleted();
      return true;
    } catch (err) {
      const message =
        process.env.NODE_ENV !== "production"
          ? (err as Error)?.message || "Failed to send quote"
          : "Failed to send quote";
      setQuoteError(`Quote saved but email failed: ${message}`);
      toast.error(`Quote saved but email failed: ${message}`);
      return false;
    } finally {
      setQuoteLoading(false);
      setQuoteAction(null);
    }
  };

  const handleSaveAndPromptSend = async () => {
    const saved = await saveQuote("save");
    if (!saved) return;
    const trimmed = quoteEmail.trim();
    setSendModalEmail(trimmed);
    setSendModalError(null);
    setShowSendModal(true);
  };

  const handleSendFromModal = async () => {
    const emailToUse = (sendModalEmail || quoteEmail).trim();
    if (!emailToUse) {
      setSendModalError("Enter an email address to send the quote.");
      return;
    }
    if (!lastSavedQuoteNumber) {
      setSendModalError("Quote number unavailable. Please save again.");
      return;
    }
    setSendModalError(null);
    setSendModalLoading(true);
    try {
      await sendQuote({ quoteNumber: lastSavedQuoteNumber, email: emailToUse });
      const issuedAt = new Date().toISOString();
      setQuotes((prev) =>
        prev.map((quote) =>
          quote.quote_number === lastSavedQuoteNumber ? { ...quote, status: "issued", issued_at: issuedAt } : quote
        )
      );
      toast.success(`Quote ${lastSavedQuoteNumber} emailed.`);
      setQuoteSuccess(`Quote ${lastSavedQuoteNumber} emailed.`);
      setLastSentEmail(emailToUse);
      triggerActionCompleted();
      setShowSendModal(false);
    } catch (err) {
      const message =
        process.env.NODE_ENV !== "production"
          ? (err as Error)?.message || "Failed to send quote"
          : "Failed to send quote";
      setSendModalError(message);
      toast.error(message);
    } finally {
      setSendModalLoading(false);
    }
  };

  const totalQty = quoteLines.reduce((sum, line) => sum + line.qty, 0);
  const totalValue = quoteLines.reduce((sum, line) => {
    const unit = Number.isFinite(line.unit_price_ex_vat) ? line.unit_price_ex_vat : 0;
    return sum + unit * line.qty;
  }, 0);
  const trimmedEmail = quoteEmail.trim();
  const hasQuoteLines = quoteLines.some((line) => line.qty > 0) || quoteLines.length > 0;
  const canSave = Boolean(trimmedEmail) && quoteLines.length > 0 && !quoteLoading && (loggedIn || privacyChecked);
  const isMissingEmail = Boolean(editingFromQuote) && !trimmedEmail;
  const canSend = canSave && !isMissingEmail;
  const canSaveDraft = loggedIn && canSave;
  const primaryCtaLabel = "Save quote";
  const currentRevision = React.useMemo(() => {
    if (!lastSavedQuoteNumber) return 0;
    const match = quotes.find((quote) => quote.quote_number === lastSavedQuoteNumber);
    return match?.revision ?? 0;
  }, [quotes, lastSavedQuoteNumber]);
  const activeRevision =
    editingFromQuote && lastSavedQuoteNumber === editingFromQuote && editingRevision !== null
      ? editingRevision
      : currentRevision;
  const quoteIdentity = lastSavedQuoteNumber
    ? `Quote ${lastSavedQuoteNumber}${activeRevision > 0 ? ` \u2014 Rev ${activeRevision}` : ""}`
    : "Quote (not saved)";
  const quoteReferenceDisplay = quoteReference.trim() || "\u2014";
  const rawFromQuote = searchParams?.get("from_quote") || "";
  const rawFromQuoteToken = searchParams?.get("token") || "";
  const rawFromQuoteEmail = searchParams?.get("e") || "";
  const fromQuoteParam = fromQuoteCleared ? "" : ((rawFromQuote || initialFromQuote || "") as string);
  const fromQuoteTokenParam = fromQuoteCleared ? "" : ((rawFromQuoteToken || initialFromQuoteToken || "") as string);
  const fromQuoteEmailParam = fromQuoteCleared ? "" : ((rawFromQuoteEmail || initialFromQuoteEmail || "") as string);

  React.useEffect(() => {
    if (rawFromQuote) setFromQuoteCleared(false);
  }, [rawFromQuote]);
  const showLoadedTick = Boolean(fromQuoteLoadedAt && Date.now() - fromQuoteLoadedAt < 1500);

  const triggerActionCompleted = React.useCallback(() => {
    setActionCompleted(true);
    if (actionCompleteTimer.current) clearTimeout(actionCompleteTimer.current);
    actionCompleteTimer.current = setTimeout(() => setActionCompleted(false), 800);
  }, []);

  const openConfirmModal = (action: "cancel" | "new") => {
    if (typeof document !== "undefined") {
      const active = document.activeElement as HTMLElement | null;
      active?.blur();
    }
    if (!hasQuoteLines) {
      clearDraft();
      triggerActionCompleted();
      return;
    }
    setConfirmAction(action);
    setShowConfirmModal(true);
  };

  React.useEffect(() => {
    if (!hasSavedQuote) return undefined;
    if (!isDirty) {
      dirtyToastShown.current = false;
      if (dirtyToastTimer.current) clearTimeout(dirtyToastTimer.current);
      return undefined;
    }
    if (dirtyToastShown.current) return undefined;
    dirtyToastTimer.current = setTimeout(() => {
      toast.info("Quote updated. Go to Summary to update & send.", { duration: 4000 });
      dirtyToastShown.current = true;
    }, 800);
    return () => {
      if (dirtyToastTimer.current) clearTimeout(dirtyToastTimer.current);
    };
  }, [isDirty, hasSavedQuote]);

  React.useEffect(() => {
    setActionCompleted(false);
  }, [quoteLines]);

  React.useEffect(() => {
    const quoteNumber = (fromQuoteParam || "").trim();
    const tokenParam = (fromQuoteTokenParam || "").trim();
    const emailParam = (fromQuoteEmailParam || "").trim();
    if (!quoteNumber) {
      setFromQuoteLoading(false);
      setEditingFromQuote(null);
      setEditingRevision(null);
      setFromQuoteError(null);
      hydratedFromQuoteKey.current = null;
      return;
    }
    const loadKey = `${quoteNumber}|${tokenParam}|${emailParam}`;
    if (hydratedFromQuoteKey.current === loadKey) {
      setFromQuoteLoading(false);
      return;
    }
    let isActive = true;
    setFromQuoteLoading(true);
    setFromQuoteError(null);
    setEditingRevision(null);
    setFromQuoteLoadedAt(null);
    const qs = new URLSearchParams();
    if (tokenParam) qs.set("token", tokenParam);
    if (emailParam) qs.set("e", emailParam.toLowerCase());
    const url = `/api/quotes/${encodeURIComponent(quoteNumber)}${qs.size ? `?${qs.toString()}` : ""}`;
    fetch(url)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!isActive) return;
        if (!res.ok || !data?.ok) {
          const message = data?.message || data?.error || `Quote ${quoteNumber} not available`;
          setFromQuoteError(message);
          setEditingFromQuote(quoteNumber);
          hydratedFromQuoteKey.current = loadKey;
          return;
        }
        const incomingLines = Array.isArray(data?.lines) ? data.lines : [];
        const normalizedLines: QuoteLine[] = incomingLines
          .map((line: any): QuoteLine => ({
            sku: String(line?.sku || "").trim(),
            name: String(line?.name || line?.sku || "").trim(),
            qty: Math.max(0, Math.floor(Number(line?.qty ?? 0))),
            unit_price_ex_vat: Number.isFinite(Number(line?.unit_price_ex_vat))
              ? Number(line.unit_price_ex_vat)
              : 0,
          }))
          .filter((line: { sku?: string; qty: number }) => Boolean(line.sku) && line.qty > 0);

        const snapshot = buildSnapshotString({
          email: data?.email || "",
          company: data?.company || "",
          reference: data?.reference || "",
          notes: data?.notes || "",
          lines: normalizedLines,
        });

        if (isDirty) {
          let shouldProceed = true;
          const revLabel = data?.revision && data.revision > 0 ? ` (Rev ${data.revision})` : "";
          if (typeof window !== "undefined") {
            const replace = window.confirm(
              `You have unsaved changes. Replace the current quote with ${quoteNumber}${revLabel}?`,
            );
            if (!replace) {
              const saveFirst = window.confirm("Save current quote first?");
              if (saveFirst) {
                await saveQuote("save");
              } else {
                shouldProceed = false;
              }
            }
          }
          if (!shouldProceed) {
            removeFromQuoteParams();
            setFromQuoteLoading(false);
            setFromQuoteError(null);
            hydratedFromQuoteKey.current = loadKey;
            return;
          }
        }

        setQuoteLines(normalizedLines);
        setQuoteEmail(data?.email || "");
        setQuoteCompany(data?.company || "");
        setQuoteReference(data?.reference || "");
        setQuoteNotes(data?.notes || "");
        setPrivacyChecked(true);
        setLastSavedQuoteNumber(data?.quote_number || quoteNumber);
        setLastSavedSnapshot(snapshot);
        setIsDirty(false);
        setDraftLoaded(true);
        setQuoteError(null);
        setQuoteSuccess(null);
        setEditingFromQuote(data?.quote_number || quoteNumber);
        setEditingRevision(typeof data?.revision === "number" ? data.revision : null);
        setFocusSearchPending(true);
        setFromQuoteLoadedAt(Date.now());
        if (mounted) {
          updateTab("quote");
        } else {
          setActiveTab("quote");
        }
        hydratedFromQuoteKey.current = loadKey;
      })
      .catch((err) => {
        if (!isActive) return;
        const message = (err as Error)?.message || "Failed to load quote";
        setFromQuoteError(message);
        setEditingFromQuote(quoteNumber);
        hydratedFromQuoteKey.current = loadKey;
      })
      .finally(() => {
        if (isActive) setFromQuoteLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [
    fromQuoteParam,
    fromQuoteTokenParam,
    fromQuoteEmailParam,
    mounted,
    updateTab,
    isDirty,
    removeFromQuoteParams,
  ]);

  React.useEffect(
    () => () => {
      if (actionCompleteTimer.current) clearTimeout(actionCompleteTimer.current);
    },
    []
  );

  const renderQuotesTab = () => {
    if (!loggedIn) {
      return (
        <Card>
          <CardContent className="space-y-2">
            <h3 className="text-lg font-semibold text-neutral-900">Login required</h3>
            <p className="text-sm text-neutral-700">
              Sign in to view your recent quotes. Need help?{" "}
              <Link href="mailto:shop@fireagent.co.uk" className="text-blue-700 hover:underline">
                Email us
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-600">Quotes</p>
            <h3 className="text-lg font-semibold text-neutral-900">Recent history</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotes.length === 0 ? <p className="text-sm text-neutral-600">No quotes yet.</p> : null}
          <div className="divide-y divide-neutral-200">
            {quotes.map((quote) => {
              const statusLabel = quote.status === "issued" ? "Issued" : "Draft";
              const statusClass =
                quote.status === "issued"
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800";
              const token = quote.publicToken;
              const pdfHref = token ? `/api/quotes/${quote.quote_number}/pdf?token=${token}` : null;
              const viewHref = token ? `/quotes/${quote.quote_number}?token=${token}` : null;
              return (
                <div key={quote.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{quote.quote_number}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      Date {formatDate(quote.created_at)} - Total {formatMoney(quote.total_value, quote.currency || baseCurrency)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {viewHref ? (
                      <Link
                        href={viewHref}
                        className="rounded-md border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-900 hover:bg-neutral-100"
                      >
                        View
                      </Link>
                    ) : null}
                    {pdfHref ? (
                      <Link
                        href={pdfHref}
                        className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                      >
                        Download PDF
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-500">PDF link unavailable</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <section className="relative left-1/2 right-1/2 w-screen max-w-[1720px] -translate-x-1/2 space-y-2 px-4 pt-0 pb-2 sm:px-6 lg:px-8">
      {editingFromQuote ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              Editing quote {editingFromQuote}
              {editingRevision && editingRevision > 0 ? ` (Rev ${editingRevision})` : ""}
            </span>
            {fromQuoteLoading ? (
              <span className="text-xs text-blue-900">Loading...</span>
            ) : showLoadedTick ? (
              <span className="flex items-center gap-1 text-xs text-blue-800">
                <span aria-hidden="true">✓</span> Loaded
              </span>
            ) : null}
            {fromQuoteError ? <span className="text-xs text-red-700">{fromQuoteError}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearFromQuote}
              className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
      {editingFromQuote && isMissingEmail ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Customer email is missing. Add an email address to send this quote.
        </div>
      ) : null}
      <TabsFrame
        variant="wide"
        activeTab={activeTab}
        onTabChange={(tabId) => updateTab(tabId as QuickQuoteTab)}
        tabs={[
          {
            id: "catalogue",
            label: "Catalogue",
            content: (
              <div className="space-y-3">
                <CataloguePicker open mode="quote" products={products} onApplyLines={applyCatalogueLines} currency={currencyCode} />
              </div>
            ),
          },
          {
            id: "quote",
            label: "Quote",
            content: (
              <div className="grid gap-4">
                <Card>
                  <CardHeader className="flex items-center justify-end pb-2">
                    <Button variant="secondary" size="sm" onClick={() => updateTab("catalogue")}>
                      Add from catalogue
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className={lineHeaderClass}>
                        <span className="min-w-0 truncate text-left text-sm font-semibold text-neutral-800">Part number</span>
                        <span className="min-w-0 truncate text-left text-sm font-semibold text-neutral-800">Description</span>
                        <span className="text-right text-sm font-semibold text-neutral-800">Qty</span>
                        <span className="text-right text-sm font-semibold text-neutral-800 leading-tight">
                          Each
                          <span className="block text-xs font-normal text-neutral-600">ex VAT ({currencyCode})</span>
                        </span>
                        <span className="text-right text-sm font-semibold text-neutral-800 leading-tight">
                          Total
                          <span className="block text-xs font-normal text-neutral-600">ex VAT ({currencyCode})</span>
                        </span>
                        <span className="justify-self-end text-right text-sm font-semibold text-neutral-800">Remove</span>
                      </div>
                      <div className="divide-y divide-neutral-200">
                        {quoteLines.length === 0 ? (
                          <div className="py-3 text-sm text-neutral-600">Add items to include them in the quote.</div>
                        ) : (
                          quoteLines.map((line) => {
                            const unit = Number.isFinite(line.unit_price_ex_vat) ? line.unit_price_ex_vat : 0;
                            const lineTotal = unit * line.qty;
                            return (
                              <LineItemRow
                                key={line.sku}
                                sku={line.sku}
                                name={line.name}
                                qty={line.qty}
                                unitDisplay={unit ? formatMoney(unit, currencyCode) : "Unit price N/A"}
                                totalDisplay={formatMoney(lineTotal, currencyCode)}
                                onQtyChange={(next) => setQuoteQuantity(line.sku, next)}
                                onIncrement={() => setQuoteQuantity(line.sku, line.qty + 1)}
                                onDecrement={() => setQuoteQuantity(line.sku, line.qty - 1)}
                                onRemove={() => removeLine(line.sku)}
                              />
                            );
                          })
                        )}
                      </div>
                      <div className={totalsRowClass}>
                        <span className="text-left text-sm font-semibold text-neutral-900">Totals</span>
                        <span />
                        <span className="text-right text-sm font-semibold text-neutral-900 tabular-nums">{totalQty}</span>
                        <span />
                        <span className="text-right text-sm font-semibold text-neutral-900 tabular-nums whitespace-nowrap">
                          {formatMoney(totalValue, currencyCode)}
                        </span>
                        <span className="justify-self-end" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ),
          },
          {
            id: "summary",
            label: (
              <span className="inline-flex items-center gap-2">
                Summary
                {totalQty > 0 ? (
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">{totalQty}</span>
                ) : null}
              </span>
            ),
            content: (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mx-auto w-full max-w-6xl lg:max-w-7xl">
                <div className="lg:col-span-7">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase text-neutral-600">Quote details</p>
                        <h3 className="text-lg font-semibold text-neutral-900">Customer & reference</h3>
                        <p className="text-xs text-neutral-600">Notes and reference stay with the quote.</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-neutral-800" htmlFor="quote-email">
                            Email
                          </label>
                          <input
                            id="quote-email"
                            type="email"
                            value={quoteEmail}
                            onChange={(e) => setQuoteEmail(e.currentTarget.value)}
                            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                            placeholder="you@example.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-neutral-800" htmlFor="quote-company">
                            Company
                          </label>
                          <input
                            id="quote-company"
                            value={quoteCompany}
                            onChange={(e) => setQuoteCompany(e.currentTarget.value)}
                            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                            placeholder="Company name"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-800" htmlFor="quote-reference">
                          Reference
                        </label>
                        <input
                          id="quote-reference"
                          value={quoteReference}
                          onChange={(e) => setQuoteReference(e.currentTarget.value)}
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                          placeholder="PO / project"
                        />
                        <p className="text-xs text-neutral-500">Optional (your PO / project ref)</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-neutral-800" htmlFor="quote-notes">
                          Notes
                        </label>
                        <textarea
                          id="quote-notes"
                          value={quoteNotes}
                          onChange={(e) => setQuoteNotes(e.currentTarget.value)}
                          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                          placeholder="Delivery info, alternatives, or special instructions"
                          rows={4}
                        />
                      </div>
                      {!loggedIn ? (
                        <label className="flex items-start gap-2 text-sm text-neutral-800">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                            checked={privacyChecked}
                            onChange={(e) => {
                              setPrivacyChecked(e.currentTarget.checked);
                              if (e.currentTarget.checked) setPrivacyError(null);
                            }}
                          />
                          <span>
                            I agree to the{" "}
                            <Link href="/privacy" className="text-blue-700 hover:underline">
                              Privacy Policy
                            </Link>{" "}
                            and understand that my quote will be processed and stored by FireAgent.
                          </span>
                        </label>
                      ) : null}
                      {privacyError ? <p className="text-xs text-red-700">{privacyError}</p> : null}
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-5">
                  <Card>
                    <CardHeader className="flex flex-col gap-3 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-xl font-semibold text-neutral-900">{quoteIdentity}</h3>
                          <p className="text-sm text-neutral-600">Ref: {quoteReferenceDisplay}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
                            onClick={handleAddAllToCart}
                          >
                            Add all to cart
                          </button>
                        </div>
                      </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 px-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-neutral-700">
                          <span>Items</span>
                          <span className="font-semibold text-neutral-900">{totalQty}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-neutral-700">
                          <span>Total (ex VAT)</span>
                          <span className="font-semibold text-neutral-900">{formatMoney(totalValue, currencyCode)}</span>
                        </div>
                      </div>

                      {quoteError ? <p className="text-xs text-red-700">{quoteError}</p> : null}
                      {quoteSuccess ? <p className="text-xs text-green-700">{quoteSuccess}</p> : null}

                      <div className="border-t border-neutral-200 pt-4 space-y-3 w-full">
                        <div
                          className={`flex w-full flex-row flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-transparent px-2 py-2 ${
                            actionCompleted ? "border-neutral-300 bg-neutral-50" : ""
                          }`}
                        >
                          <Button
                            variant="primary"
                            size="sm"
                            className="justify-center"
                            onClick={() => handleSaveAndPromptSend()}
                            disabled={!canSave || quoteLoading}
                          >
                            {quoteLoading && quoteAction === "save" ? "Saving..." : primaryCtaLabel}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className={`justify-center ${
                              !loggedIn || !canSaveDraft || quoteLoading ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                            onClick={(e) => {
                              if (!loggedIn) {
                                e.preventDefault();
                                toast.error("Login required", {
                                  description:
                                    "You need to be logged in to save drafts and recover them later. Use 'Save & send quote' to email yourself a copy.",
                                });
                                return;
                              }
                              if (!canSaveDraft || quoteLoading) return;
                              handleSaveDraft();
                            }}
                            aria-disabled={!canSaveDraft || quoteLoading || !loggedIn}
                          >
                            {quoteLoading && quoteAction === "save" ? "Saving..." : "Save draft"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="justify-center"
                            onClick={() => openConfirmModal("new")}
                            disabled={quoteLoading}
                          >
                            New quote
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="justify-center"
                            onClick={() => openConfirmModal("cancel")}
                            disabled={quoteLoading}
                          >
                            Cancel quote
                          </Button>
                        </div>
                        {lastSentEmail ? (
                          <p className="w-full text-left text-xs text-neutral-600">
                            Email sent to {lastSentEmail}. It includes a link to reopen this quote for editing and adding to cart.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                  </Card>
                </div>
              </div>
            ),
          },
          {
            id: "quotes",
            label: "Quotes",
            content: <div className="space-y-3">{renderQuotesTab()}</div>,
          },
        ]}
      />

      <Transition show={showTransferModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowTransferModal(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/20" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 translate-y-2"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2"
            >
              <Dialog.Panel className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
                <Dialog.Title className="text-base font-semibold text-neutral-900">Add all to cart</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-neutral-700">
                  Your cart already has items. Do you want to replace your cart with this quote, or merge quantities?
                </Dialog.Description>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" size="sm" onClick={() => applyQuoteToCart("merge")}>
                    Merge
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => applyQuoteToCart("replace")}>
                    Replace cart
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowTransferModal(false)}>
                    Cancel
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      <Transition show={showConfirmModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowConfirmModal(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/20" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 translate-y-2"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2"
            >
              <Dialog.Panel className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
                <Dialog.Title className="text-base font-semibold text-neutral-900">
                  {confirmAction === "new" ? "Start a new quote?" : "Cancel this quote?"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-neutral-700">
                  This will clear your current quote. You can save &amp; send first to email yourself a copy.
                </Dialog.Description>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowConfirmModal(false)}>
                    Back
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={quoteLoading}
                    onClick={async () => {
                      const sent = await handleSendQuote();
                      if (sent) {
                        clearDraft();
                        triggerActionCompleted();
                        setShowConfirmModal(false);
                      }
                    }}
                  >
                    Save &amp; send first
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      clearDraft();
                      triggerActionCompleted();
                      setShowConfirmModal(false);
                    }}
                  >
                    {confirmAction === "new" ? "Start new quote" : "Cancel quote"}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      <Transition show={showSendModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowSendModal(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/20" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 translate-y-2"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2"
            >
              <Dialog.Panel className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-xl">
                <Dialog.Title className="text-base font-semibold text-neutral-900">Send quote by email?</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-neutral-700">
                  We’ll email the PDF plus a secure link to edit and add to cart.
                </Dialog.Description>
                <div className="mt-4 space-y-3">
                  {quoteEmail.trim() ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-700">Email</p>
                      <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
                        {quoteEmail.trim()}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-800" htmlFor="send-email-input">
                        Email
                      </label>
                      <input
                        id="send-email-input"
                        type="email"
                        value={sendModalEmail}
                        onChange={(e) => setSendModalEmail(e.currentTarget.value)}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
                        placeholder="you@example.com"
                      />
                    </div>
                  )}
                  {sendModalError ? <p className="text-xs text-red-700">{sendModalError}</p> : null}
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowSendModal(false)}>
                    Not now
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSendFromModal}
                    disabled={sendModalLoading}
                  >
                    {sendModalLoading ? "Sending..." : "Send email"}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </section>
  );
}
