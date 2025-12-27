"use client";

import { useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const STORAGE_KEY = "fa_analytics_consent";

// Lightweight pre-launch consent gate. Review before adding more analytics/pixels.
export default function AnalyticsConsent() {
  const [consent, setConsent] = useState<"accepted" | "rejected" | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "accepted" || stored === "rejected") {
      setConsent(stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const handleReset = () => setConsent(null);
    window.addEventListener("fa-analytics-consent-reset", handleReset);
    return () => window.removeEventListener("fa-analytics-consent-reset", handleReset);
  }, []);

  const handleChoice = (value: "accepted" | "rejected") => {
    setConsent(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  };

  return (
    <>
      {hydrated && consent === "accepted" ? <SpeedInsights /> : null}
      {hydrated && consent === null ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[95%] max-w-3xl -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-800">
              We use essential cookies to operate the site. With your consent, we also use analytics to improve performance.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
                onClick={() => handleChoice("rejected")}
              >
                Reject
              </button>
              <button
                type="button"
                className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                onClick={() => handleChoice("accepted")}
              >
                Accept analytics
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
