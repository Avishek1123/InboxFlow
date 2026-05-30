import { apiError, apiSuccess } from "@/lib/api-response";
import { isEncryptionConfigured } from "@/lib/crypto/tokens";
import { isGoogleOAuthConfigured } from "@/lib/gmail/config";
import { requireOrganization } from "@/server/organizations/require-organization";
import { gmailRepository } from "@/server/repositories/gmail.repository";

export const runtime = "nodejs";

export async function GET() {
  const { organization } = await requireOrganization();
  const account = await gmailRepository.findGmailAccount(organization.id);

  return apiSuccess({
    configured: {
      google: isGoogleOAuthConfigured(),
      encryption: isEncryptionConfigured(),
    },
    account: account ? gmailRepository.toSummary(account) : null,
  });
}
