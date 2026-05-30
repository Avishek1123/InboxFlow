import { NextResponse } from "next/server";
import { isEncryptionConfigured } from "@/lib/crypto/tokens";
import { isGoogleOAuthConfigured } from "@/lib/gmail/config";
import { getGmailConnectUrl } from "@/server/gmail/oauth";
import { requireOrganization } from "@/server/organizations/require-organization";

export const runtime = "nodejs";

export async function GET() {
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
  const url = getGmailConnectUrl(organization.id, user.id);
  return NextResponse.redirect(url);
}
