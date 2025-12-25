"use client";

import Prose from 'components/prose';
import Link from 'next/link';
import { useState } from 'react';

type Download = { url: string; label: string };

export function ProductDetails({
  descriptionHtml,
  downloads = []
}: {
  descriptionHtml?: string;
  downloads?: Download[];
}) {
  const hasLongDescription = (descriptionHtml?.length || 0) > 600;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-8 space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-3">Key Features</h2>
        {descriptionHtml ? (
          <>
            <Prose
              className={`text-sm leading-relaxed ${
                !expanded && hasLongDescription ? 'max-h-72 overflow-hidden' : ''
              }`}
              html={descriptionHtml}
            />
            {hasLongDescription ? (
              <button
                type="button"
                className="mt-2 text-sm font-medium text-blue-600 hover:underline"
                onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-neutral-600">No feature summary available.</p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Technical Specifications</h2>
        <p className="text-sm text-neutral-600">
          Detailed technical specifications are available on request.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Standards &amp; Approvals</h2>
        <p className="text-sm text-neutral-600">
          Compliance and approvals information provided upon request.
        </p>
      </section>

      {downloads.length > 0 ? (
        <section>
          <h2 className="text-xl font-semibold mb-2">Downloads</h2>
          <ul className="space-y-2">
            {downloads.map((dl) => (
              <li key={dl.url}>
                <Link
                  href={dl.url}
                  prefetch={false}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {dl.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

