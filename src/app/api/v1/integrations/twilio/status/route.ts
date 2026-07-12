import { apiSuccess } from "@/lib/api-response";
import { isEncryptionConfigured } from "@/lib/crypto/tokens";
import { requireOrganization } from "@/server/organizations/require-organization";
import { twilioRepository } from "@/server/repositories/twilio.repository";

export const runtime = "nodejs";

export async function GET() {
  const { organization } = await requireOrganization();
  const account = await twilioRepository.findTwilioAccount(organization.id);

  return apiSuccess({
    configured: { encryption: isEncryptionConfigured() },
    account: account ? twilioRepository.toSummary(account) : null,
  });
}
