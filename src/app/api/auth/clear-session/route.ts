import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/constants";

export const runtime = "nodejs";

/** Clears an invalid __session cookie (Route Handlers may mutate cookies). */
export async function GET(request: NextRequest) {
  const redirectTo =
    request.nextUrl.searchParams.get("redirect")?.trim() || "/sign-in";
  const target = new URL(redirectTo, request.url);

  const response = NextResponse.redirect(target);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}
