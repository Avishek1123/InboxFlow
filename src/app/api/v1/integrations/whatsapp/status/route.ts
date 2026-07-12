import { apiSuccess } from "@/lib/api-response";
import { isEncryptionConfigured } from "@/lib/crypto/tokens";
import { isPlatformWebhookSecretConfigured } from "@/lib/whatsapp/config";
import { requireOrganization } from "@/server/organizations/require-organization";
import { whatsappRepository } from "@/server/repositories/whatsapp.repository";

export const runtime = "nodejs";

export async function GET() {
  const { organization } = await requireOrganization();
  const account = await whatsappRepository.findWhatsAppAccount(organization.id);

  return apiSuccess({
    configured: {
      encryption: isEncryptionConfigured(),
      platformWebhookSecret: isPlatformWebhookSecretConfigured(),
    },
    account: account ? whatsappRepository.toSummary(account) : null,
  });
}
