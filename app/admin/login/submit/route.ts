import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const nextParam = formData.get("next") || url.searchParams.get("next") || "/admin/quotes";
  const next = typeof nextParam === "string" && nextParam ? nextParam : "/admin/quotes";

  const expectedPassword = (process.env.ADMIN_PASSWORD || "").trim();
  if (!expectedPassword || password !== expectedPassword) {
    const redirectUrl = new URL("/admin/login", request.url);
    redirectUrl.searchParams.set("error", "1");
    if (next) redirectUrl.searchParams.set("next", next);
    return NextResponse.redirect(redirectUrl);
  }

  const token = createHash("sha256").update(expectedPassword).digest("hex");
  const response = NextResponse.redirect(new URL(next || "/admin/quotes", request.url));
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });

  return response;
}
