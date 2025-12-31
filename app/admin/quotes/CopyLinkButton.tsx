"use client";

import { useState } from "react";

type Props = {
  link: string;
};

export function CopyLinkButton({ link }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-sm font-semibold text-blue-700 hover:text-blue-800"
      aria-label="Copy public link"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
