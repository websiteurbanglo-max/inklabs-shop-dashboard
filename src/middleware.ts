import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicPaths = [
    "/login",
    "/onboarding",
    "/pending",
    "/select-shop",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/memberships",
    "/api/onboarding",
  ];

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // Check for both session cookie AND shop context cookie
  const session = request.cookies.get("__session");
  const shopContext = request.cookies.get("__shop_context");

  if (!session?.value) {
    // Don't redirect API routes — return 401 instead
    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!shopContext?.value) {
    // Don't redirect API routes — they should return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.next();
    }
    // Authenticated but no shop selected — redirect to shop selection
    return NextResponse.redirect(new URL("/select-shop", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
