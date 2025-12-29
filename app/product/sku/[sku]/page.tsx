import { redirect } from "next/navigation";

import skuLookup from "data/pim/sku_lookup.json";

export const dynamic = "force-dynamic";

async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

export default async function ProductSkuRedirectPage(props: { params: Promise<{ sku: string }> }) {
  const params = await resolveParams<{ sku?: string }>(props.params);
  const sku = params.sku?.trim();

  if (!sku) {
    return <DebugPage title="Missing SKU" message="No SKU was provided in the URL." />;
  }

  const normalizedSku = sku.toLowerCase();
  const normalizedLookup = Object.fromEntries(
    Object.entries(skuLookup).map(([key, value]) => [key.toLowerCase(), value]),
  );

  const handle = normalizedLookup[normalizedSku];

  if (handle) {
    // Server redirect for canonical PDP URL
    redirect(`/product/${encodeURIComponent(handle)}`);
  }

  return (
    <DebugPage
      title="Product handle unavailable"
      message={`Found SKU ${sku} but no product handle mapping was provided.`}
      details={{ sku }}
    />
  );
}

function DebugPage({
  title,
  message,
  details,
}: {
  title: string;
  message: string;
  details?: any;
}) {
  const showDetails = process.env.NODE_ENV === "development" && details;
  return (
    <div className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-3 text-sm text-neutral-600">{message}</p>

      {showDetails ? (
        <pre className="mt-6 overflow-auto rounded bg-neutral-100 p-4 text-xs text-neutral-800">
          {JSON.stringify(details, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
