import { LoginForm } from "./LoginForm";

type FormState = { error: string | null };
type Props = { searchParams?: Promise<{ next?: string }> };

async function resolveParams<T extends Record<string, unknown>>(params: any): Promise<T> {
  if (params && typeof params.then === "function") return (await params) as T;
  return (params ?? {}) as T;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const resolvedSearch = await resolveParams<{ next?: string; error?: string }>(searchParams ?? {});
  const nextPath = resolvedSearch.next || "/admin/quotes";
  const showError = resolvedSearch.error === "1";

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-12">
      <div className="w-full rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 space-y-1">
          <p className="text-sm font-semibold text-neutral-800">FireAgent Admin</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Login</h1>
          <p className="text-sm text-neutral-600">Enter the admin password to continue.</p>
        </div>
        <LoginForm nextPath={nextPath} showError={showError} />
      </div>
    </section>
  );
}
