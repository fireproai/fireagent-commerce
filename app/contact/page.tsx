export default function ContactPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 space-y-6">
      <h1 className="text-3xl font-bold">Contact Us</h1>
      <p className="text-neutral-700">
        Need a part fast or guidance on a system? Reach out to the FireAgent team and we&apos;ll get
        you an answer quickly.
      </p>
      <div className="space-y-3 text-neutral-700">
        <p>Email: <span className="font-semibold">support@fireagent.com</span></p>
        <p>Phone: <span className="font-semibold">+1 (800) 555-0145</span></p>
        <p>Trade hours: Monday–Friday, 7:30am–5:30pm (local time)</p>
      </div>
      <p className="text-neutral-700">
        For urgent site calls or bulk quotes, include the SKU, quantity, and required ship date so
        we can prioritize your request.
      </p>
    </main>
  );
}

