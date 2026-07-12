import { createHmac, timingSafeEqual } from "crypto";
import {
  isPlatformWebhookSecretConfigured,
} from "@/lib/whatsapp/config";
import { whatsappRepository } from "@/server/repositories/whatsapp.repository";

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | null
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected =
    "sha256=" +
    createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  try {
    return timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader)
    );
  } catch {
    return false;
  }
}

export async function resolveWebhookAppSecret(
  phoneNumberId: string | undefined
): Promise<string | null> {
  if (phoneNumberId) {
    const account = await whatsappRepository.findByPhoneNumberId(phoneNumberId);
    if (account) {
      return whatsappRepository.getWebhookAppSecret(account);
    }
  }
  if (isPlatformWebhookSecretConfigured()) {
    return (
      process.env.META_APP_SECRET ??
      process.env.WHATSAPP_APP_SECRET ??
      null
    );
  }
  return null;
}

export function extractPhoneNumberIdFromPayload(body: {
  entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }>;
}): string | undefined {
  return body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
}
