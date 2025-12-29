import fs from "node:fs";
import path from "node:path";

const MAP_PATH = path.join(process.cwd(), "data", "shopify_variant_map.json");

type VariantMap = Record<string, string>;

let cached: VariantMap | null = null;
let warnedMissing: Set<string> = new Set();

function loadMap(): VariantMap {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(MAP_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      cached = parsed as VariantMap;
      return cached;
    }
  } catch {
    // ignore
  }
  cached = {};
  return cached;
}

export function getMerchandiseIdForSku(sku: string): string | null {
  if (!sku) return null;
  const map = loadMap();
  const key = sku.toString();
  const id = map[key] ?? null;

  if (process.env.NODE_ENV !== "production" && !id) {
    if (!warnedMissing.has(key)) {
      warnedMissing.add(key);
      // eslint-disable-next-line no-console
      console.warn("[variant-map] Missing merchandiseId for SKU:", key);
    }
  }

  return id;
}

export function hasMerchandiseId(sku: string): boolean {
  return Boolean(getMerchandiseIdForSku(sku));
}
