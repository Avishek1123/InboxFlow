import { apiSuccess } from "@/lib/api-response";
import { isEncryptionConfigured } from "@/lib/crypto/tokens";
import { isGoogleOAuthConfigured } from "@/lib/gmail/config";
import { hasGoogleSheetsScopes } from "@/lib/gmail/scopes";
import { getGmailTokenHealth } from "@/server/google/gmail-token-health";
import { requireOrganization } from "@/server/organizations/require-organization";
import { gmailRepository } from "@/server/repositories/gmail.repository";

export const runtime = "nodejs";

export async function GET() {
  const { organization } = await requireOrganization();
  const account = await gmailRepository.findGmailAccount(organization.id);
  const tokenHealth = await getGmailTokenHealth(account);

  return apiSuccess({
    configured: {
      google: isGoogleOAuthConfigured(),
      encryption: isEncryptionConfigured(),
    },
    account:
      account &&
      (account.status === "ACTIVE" || account.status === "TOKEN_EXPIRED")
        ? gmailRepository.toSummary(account)
        : null,
    sheetsScopesGranted: account
      ? hasGoogleSheetsScopes(account.scopes)
      : false,
    oauthProjectMismatch: tokenHealth.storedProjectMismatch || tokenHealth.legacyOAuthToken,
    legacyOAuthToken: tokenHealth.legacyOAuthToken,
    legacyOAuthProject: tokenHealth.legacyOAuthProject,
    refreshTokenInvalid: tokenHealth.refreshTokenInvalid,
    reconnectMessage: tokenHealth.reconnectMessage,
    needsReconnect: tokenHealth.needsReconnect,
    reconnectUrl: "/api/v1/integrations/gmail/connect?reconnect=1",
  });
}
