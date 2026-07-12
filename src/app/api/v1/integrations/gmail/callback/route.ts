import { NextRequest, NextResponse } from "next/server";
import { assertInboxflowOAuthClientConfigured } from "@/lib/gmail/inboxflow-gcp";
import { parseOAuthState } from "@/lib/gmail/oauth-state";
import {
  accessTokenClientMismatchMessage,
  getAccessTokenClientId,
} from "@/server/google/verify-access-token";
import { oauthPopupCloseHtml } from "@/lib/oauth/popup-close-html";
import { exchangeCodeForTokens } from "@/server/gmail/oauth";
import { gmailRepository } from "@/server/repositories/gmail.repository";

export const runtime = "nodejs";
export const maxDuration = 60;

function popupHtml(
  parsed: { popup?: boolean; openerOrigin?: string } | null,
  ok: boolean,
  message: string
) {
  if (!parsed?.popup) return null;
  return new NextResponse(
    oauthPopupCloseHtml({
      ok,
      message,
      openerOrigin: parsed.openerOrigin,
    }),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const base = new URL("/integrations/gmail", request.url);
  const parsedEarly = state ? parseOAuthState(state) : null;

  if (error) {
    const popup = popupHtml(parsedEarly, false, error);
    if (popup) return popup;
    base.searchParams.set("error", error);
    return NextResponse.redirect(base);
  }

  if (!code || !state) {
    const popup = popupHtml(parsedEarly, false, "Missing authorization code");
    if (popup) return popup;
    base.searchParams.set("error", "missing_code");
    return NextResponse.redirect(base);
  }

  const parsed = parseOAuthState(state);
  if (!parsed) {
    const popup = popupHtml(parsedEarly, false, "Invalid session state");
    if (popup) return popup;
    base.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(base);
  }

  try {
    assertInboxflowOAuthClientConfigured();

    const { tokens, email, googleId } = await exchangeCodeForTokens(code);

    const expectedClientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (expectedClientId && tokens.access_token) {
      const aud = await getAccessTokenClientId(tokens.access_token);
      if (aud && aud !== expectedClientId) {
        throw new Error(accessTokenClientMismatchMessage(aud, expectedClientId));
      }
    }

    if (!email) {
      const popup = popupHtml(parsed, false, "Google did not return an email");
      if (popup) return popup;
      base.searchParams.set("error", "no_email");
      return NextResponse.redirect(base);
    }

    let refreshToken = tokens.refresh_token ?? null;
    if (!refreshToken) {
      const existing = await gmailRepository.findGmailAccount(
        parsed.organizationId
      );
      if (existing?.encryptedRefreshToken) {
        const decrypted = await gmailRepository.getDecryptedTokens(existing);
        refreshToken = decrypted.refreshToken;
      }
    }

    if (!refreshToken) {
      const msg =
        "No refresh token from Google. On the Gmail integration page use Reconnect and approve all permissions.";
      const popup = popupHtml(parsed, false, msg);
      if (popup) return popup;
      base.searchParams.set("error", "no_refresh_token");
      return NextResponse.redirect(base);
    }

    await gmailRepository.upsertFromOAuth({
      organizationId: parsed.organizationId,
      userId: parsed.userId,
      accountEmail: email,
      externalAccountId: googleId,
      accessToken: tokens.access_token!,
      refreshToken,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope?.split(" ").filter(Boolean) ?? [],
    });

    const popup = popupHtml(
      parsed,
      true,
      "Google permissions saved. Finishing sheet setup in InboxFlow…"
    );
    if (popup) return popup;

    base.searchParams.set("connected", "1");
    if (parsed.sheetExportId) {
      base.searchParams.set("sheetExportId", parsed.sheetExportId);
    }
    return NextResponse.redirect(base);
  } catch (err) {
    console.error("[gmail/callback]", err);
    const message = err instanceof Error ? err.message : "oauth_failed";
    const popup = popupHtml(parsed, false, message);
    if (popup) return popup;
    base.searchParams.set("error", message);
    return NextResponse.redirect(base);
  }
}
