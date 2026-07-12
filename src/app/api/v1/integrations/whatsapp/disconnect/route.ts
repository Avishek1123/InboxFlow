import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { whatsappRepository } from "@/server/repositories/whatsapp.repository";

export const runtime = "nodejs";

export async function POST() {
  const { organization } = await requireOrganization();
  const account = await whatsappRepository.findWhatsAppAccount(organization.id);

  if (!account) {
    return apiError("NOT_FOUND", "No WhatsApp account connected", 404);
  }

  await whatsappRepository.disconnect(account.id);
  return apiSuccess({ disconnected: true });
}
