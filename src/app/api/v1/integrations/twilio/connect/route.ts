import { apiError, apiSuccess } from "@/lib/api-response";
import { isEncryptionConfigured } from "@/lib/crypto/tokens";
import { twilioConnectSchema } from "@/lib/validations/twilio";
import { requireOrganization } from "@/server/organizations/require-organization";
import { fetchTwilioAccountProfile } from "@/server/twilio/graph";
import { twilioRepository } from "@/server/repositories/twilio.repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isEncryptionConfigured()) {
    return apiError(
      "ENCRYPTION_NOT_CONFIGURED",
      "Set TOKEN_ENCRYPTION_KEY in .env before connecting Twilio",
      503
    );
  }

  const { organization, user } = await requireOrganization();
  const parsed = twilioConnectSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Invalid Twilio credentials",
      400,
      parsed.error.flatten()
    );
  }

  const { accountSid, authToken, smsPhoneNumber, whatsappPhoneNumber } =
    parsed.data;

  try {
    const profile = await fetchTwilioAccountProfile(
      accountSid.trim(),
      authToken.trim()
    );

    const account = await twilioRepository.upsertFromCredentials({
      organizationId: organization.id,
      userId: user.id,
      accountSid: accountSid.trim(),
      authToken: authToken.trim(),
      smsPhoneNumber,
      whatsappPhoneNumber: whatsappPhoneNumber || undefined,
      friendlyName: profile.friendly_name,
    });

    return apiSuccess({
      connectedAccountId: account.id,
      account: twilioRepository.toSummary(account),
    });
  } catch (err) {
    return apiError(
      "TWILIO_CONNECT_FAILED",
      err instanceof Error ? err.message : "Could not verify Twilio credentials",
      400
    );
  }
}
