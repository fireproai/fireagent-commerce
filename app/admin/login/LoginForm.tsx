"use client";

type Props = {
  nextPath: string;
  showError: boolean;
};

export function LoginForm({ nextPath, showError }: Props) {
  return (
    <form method="post" action="/admin/login/submit" className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <div className="space-y-1">
        <label className="text-sm font-medium text-neutral-800" htmlFor="password">
          Admin password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-200"
          placeholder="Enter password"
        />
      </div>
      {showError ? <p className="text-sm text-red-700">Invalid password.</p> : null}
      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
      >
        Login
      </button>
    </form>
  );
}
