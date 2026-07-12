import { NextRequest, NextResponse } from "next/server";
import { isEncryptionConfigured } from "@/lib/crypto/tokens";
import { isGoogleOAuthConfigured } from "@/lib/gmail/config";
import { getGmailConnectUrl } from "@/server/gmail/oauth";
import { requireOrganization } from "@/server/organizations/require-organization";
import { gmailRepository } from "@/server/repositories/gmail.repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "GOOGLE_NOT_CONFIGURED",
          message:
            "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env. See .env.example",
        },
      },
      { status: 503 }
    );
  }

  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "ENCRYPTION_NOT_CONFIGURED",
          message: "Set TOKEN_ENCRYPTION_KEY in .env before connecting Gmail",
        },
      },
      { status: 503 }
    );
  }

  const { organization, user } = await requireOrganization();
  const reconnect = request.nextUrl.searchParams.get("reconnect") === "1";
  const popup = request.nextUrl.searchParams.get("popup") === "1";
  const sheetExportId = request.nextUrl.searchParams.get("sheetExportId");
  const openerOriginParam = request.nextUrl.searchParams.get("openerOrigin");

  // Prefer the browser tab origin (localhost vs tunnel) so postMessage works.
  let openerOrigin = new URL(request.url).origin;
  if (openerOriginParam) {
    try {
      const parsed = new URL(openerOriginParam);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        openerOrigin = parsed.origin;
      }
    } catch {
      /* keep request origin */
    }
  }

  // Popup sheet flow: keep existing refresh token; only re-consent for scopes.
  if (reconnect && !popup) {
    const existing = await gmailRepository.findGmailAccount(organization.id);
    if (existing) {
      await gmailRepository.disconnect(existing.id);
    }
  }

  const url = getGmailConnectUrl(organization.id, user.id, {
    popup,
    sheetExportId: sheetExportId ?? undefined,
    openerOrigin,
  });
  return NextResponse.redirect(url);
}
