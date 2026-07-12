import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { twilioRepository } from "@/server/repositories/twilio.repository";

export const runtime = "nodejs";

export async function POST() {
  const { organization } = await requireOrganization();
  const account = await twilioRepository.findTwilioAccount(organization.id);

  if (!account) {
    return apiError("NOT_FOUND", "No Twilio account connected", 404);
  }

  await twilioRepository.disconnect(account.id);
  return apiSuccess({ disconnected: true });
}
