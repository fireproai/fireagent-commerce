// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_session";
const LOGIN_PATH = "/admin/login";
const LOGIN_SUBMIT_PATH = "/admin/login/submit";

// Edge-safe SHA-256 (no Node crypto)
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function redirect(req: NextRequest, path: string) {
  const url = req.nextUrl.clone();
  url.pathname = path;
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Allow login page + submit endpoint
  if (pathname === LOGIN_PATH || pathname === LOGIN_SUBMIT_PATH) return NextResponse.next();

  // Only protect /admin/*
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // Convenience redirect
  if (pathname === "/admin") return redirect(request, "/admin/quotes");

  const password = (process.env.ADMIN_PASSWORD || "").trim();
  if (!password) {
    return new NextResponse("ADMIN_PASSWORD not set", { status: 500 });
  }

  const expectedToken = await sha256Hex(password);
  const sessionCookie = request.cookies.get(ADMIN_COOKIE)?.value || "";

  if (sessionCookie !== expectedToken) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    if (pathname && pathname !== "/admin") {
      loginUrl.searchParams.set("next", `${pathname}${search || ""}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
