#!/usr/bin/env node

const baseUrl = process.env.BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
const healthEndpoint = `${baseUrl}/api/health`;
const cartEndpoint = `${baseUrl}/api/health/cart`;

async function main() {
  try {
    const res = await fetch(healthEndpoint, { headers: { "Content-Type": "application/json" }, cache: "no-store" });
    const data = await res.json();
    const status = data?.status || "fail";
    console.log(`Health status: ${status}`);
    if (data?.checks) {
      Object.entries(data.checks).forEach(([key, value]) => {
        if (!value) return;
        const line = `${key}: ${value.status}`;
        console.log(line);
        if (value.status !== "ok" && value.details) {
          const reason = value.details.reason || "";
          const code = value.details.lastStatusCode ? ` (code ${value.details.lastStatusCode})` : "";
          if (reason || code) {
            console.log(`  -> ${reason}${code}`);
          }
        }
      });
    }

    const skuResults = data?.checks?.skuSample?.details?.results;
    const shouldRunCart =
      (data?.checks?.skuSample?.status === "ok" || data?.checks?.skuSample?.status === "degraded") &&
      Array.isArray(skuResults) &&
      skuResults.length > 0;

    if (shouldRunCart) {
      try {
        const cartRes = await fetch(cartEndpoint, { headers: { "Content-Type": "application/json" }, cache: "no-store" });
        const cartData = await cartRes.json();
        const cartStatus = cartData?.status || "fail";
        console.log(`Cart health: ${cartStatus}`);
        if (cartData?.details) {
          const { sku, reason, lineCount } = cartData.details;
          const extra = [];
          if (sku) extra.push(`sku=${sku}`);
          if (typeof lineCount === "number") extra.push(`lines=${lineCount}`);
          if (reason) extra.push(`reason=${reason}`);
          if (extra.length) console.log(`  -> ${extra.join(", ")}`);
        }
        if (cartStatus === "fail") {
          process.exit(1);
        }
      } catch (err) {
        console.error("Cart health error:", err?.message || err);
        process.exit(1);
      }
    }

    if (status === "fail") {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error("Healthcheck error:", err?.message || err);
    process.exit(1);
  }
}

main();
