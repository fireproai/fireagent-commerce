import Link from "next/link";

import pimProducts from "data/pim/pim_products.json";

export const dynamic = "force-dynamic";

type PimProduct = {
  sku: string;
  product_name?: string;
  handle?: string;
  description?: string;
  nav_root?: string;
  nav_group?: string;
  nav_group_1?: string;
};

async function resolveParams<T extends Record<string, any>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

export default async function ProductPage(props: { params: Promise<{ handle: string }> }) {
  const params = await resolveParams<{ handle?: string }>(props.params);
  const handleSlug = params.handle?.toLowerCase() ?? "";

  if (!handleSlug) {
    return (
      <DebugPage title="Missing handle" message="No product handle was provided in the URL." />
    );
  }

  const products = (Array.isArray(pimProducts) ? pimProducts : []) as PimProduct[];
  const product = products.find((p) => (p.handle ?? "").toLowerCase() === handleSlug);

  if (!product) {
    return (
      <DebugPage
        title="Product not found"
        message="No product matched this handle in PIM data."
        details={{ handle: handleSlug }}
      />
    );
  }

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <Breadcrumbs handle={product.handle || handleSlug} name={product.product_name || product.sku} />

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-neutral-900">
            {product.product_name || product.sku}
          </h1>
          <p className="text-sm text-neutral-600">SKU: {product.sku}</p>
          <p className="text-sm text-neutral-600">
            Categories: {product.nav_root || "N/A"}{" "}
            {product.nav_group ? `› ${product.nav_group}` : ""}{" "}
            {product.nav_group_1 ? `› ${product.nav_group_1}` : ""}
          </p>
        </div>

        {product.description ? (
          <p className="mt-4 text-sm leading-6 text-neutral-700">{product.description}</p>
        ) : (
          <p className="mt-4 text-sm text-neutral-600">
            This product is sourced from PIM data. Additional details are not available yet.
          </p>
        )}
      </div>
    </section>
  );
}

function Breadcrumbs({ handle, name }: { handle: string; name: string }) {
  return (
    <nav className="text-sm text-neutral-600" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/" className="hover:text-neutral-900">
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link href="/products" className="hover:text-neutral-900">
            Products
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="text-neutral-900 font-medium">{name || handle}</li>
      </ol>
    </nav>
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
    <section className="mx-auto max-w-xl px-6 py-24">
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-3 text-sm text-neutral-600">{message}</p>
      {showDetails ? (
        <pre className="mt-6 overflow-auto rounded bg-neutral-100 p-4 text-xs text-neutral-800">
          {JSON.stringify(details, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}
