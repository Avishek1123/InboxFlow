import { randomBytes } from "crypto";
import { apiError, apiSuccess } from "@/lib/api-response";
import { isEncryptionConfigured } from "@/lib/crypto/tokens";
import { whatsappConnectSchema } from "@/lib/validations/whatsapp";
import { requireOrganization } from "@/server/organizations/require-organization";
import { fetchPhoneNumberProfile } from "@/server/whatsapp/graph";
import { whatsappRepository } from "@/server/repositories/whatsapp.repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isEncryptionConfigured()) {
    return apiError(
      "ENCRYPTION_NOT_CONFIGURED",
      "Set TOKEN_ENCRYPTION_KEY in .env before connecting WhatsApp",
      503
    );
  }

  const { organization, user } = await requireOrganization();
  const parsed = whatsappConnectSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Invalid credentials",
      400,
      parsed.error.flatten()
    );
  }

  const { phoneNumberId, whatsappBusinessAccountId, accessToken } = parsed.data;

  try {
    const profile = await fetchPhoneNumberProfile(phoneNumberId, accessToken);
    const displayPhone =
      profile.display_phone_number ||
      profile.verified_name ||
      phoneNumberId;

    const webhookVerifyToken = randomBytes(16).toString("hex");

    const account = await whatsappRepository.upsertFromCredentials({
      organizationId: organization.id,
      userId: user.id,
      phoneNumberId: phoneNumberId.trim(),
      whatsappBusinessAccountId: whatsappBusinessAccountId.trim(),
      accessToken: accessToken.trim(),
      businessPhone: displayPhone,
      webhookVerifyToken,
      metaAppId: process.env.META_APP_ID?.trim(),
      metaAppSecret:
        process.env.META_APP_SECRET?.trim() ??
        process.env.WHATSAPP_APP_SECRET?.trim(),
      verifiedName: profile.verified_name,
    });

    return apiSuccess({
      connectedAccountId: account.id,
      account: whatsappRepository.toSummary(account),
    });
  } catch (err) {
    return apiError(
      "WHATSAPP_CONNECT_FAILED",
      err instanceof Error ? err.message : "Could not verify WhatsApp credentials",
      400
    );
  }
}
