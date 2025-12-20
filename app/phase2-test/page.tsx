async function getBaseUrl() {
  // Works on Vercel + local
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default async function Phase2TestPage() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/phase2-test`, { cache: "no-store" });
  const json = await res.json();
  const p = json.product;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Phase-2 Test Render</h1>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700 }}>{p.product_name}</div>
        <div style={{ opacity: 0.8, marginTop: 4 }}>SKU: {p.sku}</div>
        <div style={{ marginTop: 8 }}>{p.product_description}</div>

        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Key data</h2>
          <ul>
            <li>Price list 2025: {p.list_price_2025}</li>
            <li>Category: {p.category}</li>
            <li>
              Subcategory: {p.subcategory_1} → {p.subcategory_2}
            </li>
            <li>IP rating: {p.extensions?.ip_rating}</li>
            <li>Voltage: {p.extensions?.operating_voltage}</li>
            <li>Approvals: {(p.extensions?.approvals ?? []).join(", ")}</li>
          </ul>
        </div>

        <details style={{ marginTop: 16 }}>
          <summary>Raw Phase-2 JSON</summary>
          <pre
            style={{
              background: "#f6f6f6",
              padding: 12,
              borderRadius: 12,
              overflow: "auto",
            }}
          >
            {JSON.stringify(p, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  );
}
