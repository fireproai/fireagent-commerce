"use client";

const STORAGE_KEY = "fa_analytics_consent";

export default function CookieSettingsLink() {
  const resetConsent = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event("fa-analytics-consent-reset"));
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      className="text-left text-neutral-600 hover:text-neutral-900"
      onClick={resetConsent}
    >
      Cookie settings
    </button>
  );
}
