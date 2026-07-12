import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/constants";

const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/api/health",
  "/api/auth/session",
  "/api/auth/clear-session",
  "/api/v1/webhooks",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (pathname.startsWith("/api/cron")) return true;
  if (pathname.startsWith("/api/v1/webhooks")) return true;
  if (pathname === "/api/v1/integrations/gmail/callback") return true;
  /** Apps Script + tunnel health (API key auth on /data only). */
  if (pathname.startsWith("/api/v1/sheet-sync")) return true;
  return false;
}

/**
 * Edge-safe middleware: cookie presence only.
 * Full session verification runs in Node.js (API routes + dashboard layout).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    // Do not redirect to /dashboard based on cookie presence alone — an expired or
    // invalid __session cookie would loop: middleware → dashboard → sign-in → middleware.
    // Auth layout uses verifySessionCookie and only redirects when the session is valid.
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in required" } },
        { status: 401 }
      );
    }
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
