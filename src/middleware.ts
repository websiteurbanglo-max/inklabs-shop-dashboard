import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // Fully public routes — no auth required at all
  const fullyPublicPaths = [
    "/api/auth/login",
    "/api/auth/logout",
  ];

  if (fullyPublicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get("__session");
  const shopContext = request.cookies.get("__shop_context");

  // ── Login page ──────────────────────────────────────────────────────
  if (pathname === "/login" || pathname === "/login/") {
    // If user is already authenticated, redirect away from login
    if (session?.value && shopContext?.value) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (session?.value && !shopContext?.value) {
      return NextResponse.redirect(new URL("/select-shop", request.url));
    }
    // Not authenticated — show login page
    return NextResponse.next();
  }

  // ── Session-only pages (need login, but NOT shop context) ───────────
  const sessionOnlyPaths = [
    "/onboarding",
    "/pending",
    "/select-shop",
    "/api/auth/memberships",
    "/api/auth/select-shop",
    "/api/onboarding",
  ];

  if (sessionOnlyPaths.some((p) => pathname.startsWith(p))) {
    if (!session?.value) {
      if (pathname.startsWith("/api/")) {
        return Response.json({ error: "Not authenticated" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Has session — allow through (these pages handle their own logic)
    return NextResponse.next();
  }

  // ── All other routes: require session + shop context ────────────────
  if (!session?.value) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!shopContext?.value) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/select-shop", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
