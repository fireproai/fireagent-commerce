"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

// TermsGate stores acceptance locally (localStorage key: fa_terms_ok_<termsVersion>)
// and on Shopify cart attributes (terms_accepted, terms_accepted_at, terms_version, terms_url)
// so checkout is blocked until the latest acceptance is saved.

type TermsGateState = {
  ready: boolean;
  accepted: boolean;
  saving: boolean;
  saved: boolean;
  error?: string | null;
};

type TermsGateProps = {
  cartId?: string;
  termsVersion?: string;
  onStatusChange?: (state: TermsGateState) => void;
};

const TERMS_VERSION = "2025-12-26";
const TERMS_URL = "/policies/terms-of-service";
const PRIVACY_URL = "/policies/privacy-policy";

export default function TermsGate({ cartId, termsVersion = TERMS_VERSION, onStatusChange }: TermsGateProps) {
  const storageKey = useMemo(() => `fa_terms_ok_${termsVersion}`, [termsVersion]);
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastEmitted = useRef<Pick<TermsGateState, "ready" | "accepted" | "saving" | "saved"> | null>(null);
  const didHydrate = useRef(false);
  const lastStoredAccepted = useRef<boolean | null>(null);
  const hasInteracted = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(storageKey);
    setAccepted(stored === "true");
    setReady(true);
    didHydrate.current = true;
    lastStoredAccepted.current = stored === "true";
  }, [storageKey]);

  useEffect(() => {
    const next = { ready, accepted, saving, saved };
    const prev = lastEmitted.current;
    const changed =
      !prev ||
      prev.ready !== next.ready ||
      prev.accepted !== next.accepted ||
      prev.saving !== next.saving ||
      prev.saved !== next.saved;
    if (!changed) return;
    lastEmitted.current = next;
    onStatusChange?.(next);
  }, [ready, accepted, saving, saved, onStatusChange]);

  useEffect(() => {
    if (!ready || !didHydrate.current) return;
    const hasChangedSinceHydration = lastStoredAccepted.current !== accepted;
    if (hasChangedSinceHydration && typeof window !== "undefined") {
      localStorage.setItem(storageKey, accepted ? "true" : "false");
      lastStoredAccepted.current = accepted;
    }
    if (!cartId) {
      setSaved(false);
      return;
    }

    if (!hasInteracted.current && !hasChangedSinceHydration) {
      return;
    }

    const controller = new AbortController();
    const persist = async () => {
      setSaving(true);
      setError(null);
      setSaved(false);
      const payload = {
        cartId,
        attributes: {
          terms_accepted: accepted ? "yes" : "no",
          terms_accepted_at: accepted ? new Date().toISOString() : "",
          terms_version: termsVersion,
          terms_url: TERMS_URL,
        },
      };

      try {
        const res = await fetch("/api/cart/attributes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          const apiErrors = Array.isArray(data?.errors) ? data.errors : [];
          const message =
            apiErrors?.[0]?.message ||
            (typeof data?.error === "string" ? data.error : "") ||
            "Unable to save acceptance";
          setError(message);
          setSaved(false);
        } else {
          setSaved(true);
          setError(null);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setError("Unable to save acceptance");
          setSaved(false);
        }
      } finally {
        setSaving(false);
      }
    };

    void persist();

    return () => controller.abort();
  }, [accepted, cartId, ready, storageKey, termsVersion]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <label className="flex items-start gap-3 text-sm text-neutral-900">
        <input
          type="checkbox"
          className="mt-[3px] h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-700"
          checked={accepted}
          onChange={(event) => {
            hasInteracted.current = true;
            setAccepted(event.target.checked);
            setSaved(false);
            setError(null);
          }}
          disabled={saving}
        />
        <span>
          I agree to the{" "}
          <Link href={TERMS_URL} target="_blank" rel="noreferrer" className="underline hover:text-neutral-700">
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link href={PRIVACY_URL} target="_blank" rel="noreferrer" className="underline hover:text-neutral-700">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <p className="mt-2 text-xs text-neutral-600">
        Trade-only supply. Installation must be carried out by a competent / suitably qualified person.
      </p>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {saving ? <p className="mt-2 text-xs text-neutral-500">Saving confirmation...</p> : null}
      {!saving && saved && accepted ? (
        <p className="mt-2 text-xs text-green-700">Confirmation saved.</p>
      ) : null}
    </div>
  );
}
