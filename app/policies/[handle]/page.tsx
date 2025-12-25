import { notFound as nextNotFound } from "next/navigation";
import { shopifyFetch } from "lib/shopify";

export const revalidate = 3600;

const POLICY_FIELDS = {
  privacy: "privacyPolicy",
  refund: "refundPolicy",
  shipping: "shippingPolicy",
  terms: "termsOfService",
} as const;

type PolicyHandle = keyof typeof POLICY_FIELDS;

type PolicyData = {
  title: string | null;
  body: string | null;
} | null;

const POLICY_QUERY = `
  query ShopPolicies {
    shop {
      name
      privacyPolicy { title body }
      refundPolicy { title body }
      shippingPolicy { title body }
      termsOfService { title body }
    }
  }
`;

async function fetchPolicies() {
  const res = await shopifyFetch<{
    data?: { shop?: Record<string, PolicyData> & { name?: string | null } };
  }>({
    query: POLICY_QUERY,
  });

  return res?.body?.data?.shop ?? null;
}

export default async function PolicyPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const policyHandle = handle as PolicyHandle;
  if (!(policyHandle in POLICY_FIELDS)) {
    nextNotFound();
  }

  const policies = await fetchPolicies();
  const policy = policies?.[POLICY_FIELDS[policyHandle]] as PolicyData;
  const shopName = policies?.name ?? null;

  const title = policy?.title || "Policy";
  const body = policy?.body;
  const showDebug = process.env.DEBUG_POLICIES === "true";
  const missingField = !policy ? POLICY_FIELDS[policyHandle] : null;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-4 py-8">
      <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
      {body ? (
        <article
          className="prose max-w-none text-neutral-800"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ) : (
        <p className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          This policy hasn&apos;t been configured yet.
        </p>
      )}
      {showDebug ? (
        <div className="rounded border border-dashed border-neutral-300 bg-white p-3 text-xs text-neutral-600">
          {shopName ? <p>Shop: {shopName}</p> : null}
          {missingField ? <p>Missing policy field: {missingField}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
