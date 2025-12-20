import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  const filePath = path.join(process.cwd(), "data", "phase2_test.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const product = JSON.parse(raw);

  return NextResponse.json({ ok: true, product });
}
