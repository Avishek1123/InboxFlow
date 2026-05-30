import { NextRequest, NextResponse } from "next/server";
import { parseOAuthState } from "@/lib/gmail/oauth-state";
import { exchangeCodeForTokens } from "@/server/gmail/oauth";
import { gmailRepository } from "@/server/repositories/gmail.repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = new URL("/integrations/gmail", request.url);

  if (error) {
    base.searchParams.set("error", error);
    return NextResponse.redirect(base);
  }

  if (!code || !state) {
    base.searchParams.set("error", "missing_code");
    return NextResponse.redirect(base);
  }

  const parsed = parseOAuthState(state);
  if (!parsed) {
    base.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(base);
  }

  try {
    const { tokens, email, googleId } = await exchangeCodeForTokens(code);

    if (!email) {
      base.searchParams.set("error", "no_email");
      return NextResponse.redirect(base);
    }

    await gmailRepository.upsertFromOAuth({
      organizationId: parsed.organizationId,
      userId: parsed.userId,
      accountEmail: email,
      externalAccountId: googleId,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope?.split(" ") ?? [],
    });

    base.searchParams.set("connected", "1");
    return NextResponse.redirect(base);
  } catch (err) {
    console.error("[gmail/callback]", err);
    base.searchParams.set(
      "error",
      err instanceof Error ? err.message : "oauth_failed"
    );
    return NextResponse.redirect(base);
  }
}
