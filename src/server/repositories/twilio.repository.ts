import type { ConnectedAccount, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto/tokens";
import { getTwilioWebhookUrl } from "@/lib/twilio/config";
import { prisma } from "@/server/db";
import type { TwilioAccountSummary } from "@/types/twilio";

export type TwilioAccountMetadata = {
  whatsappPhoneNumber?: string;
  friendlyName?: string;
};

export function parseTwilioMetadata(metadata: unknown): TwilioAccountMetadata {
  if (!metadata || typeof metadata !== "object") return {};
  return metadata as TwilioAccountMetadata;
}

export const twilioRepository = {
  async findTwilioAccount(organizationId: string) {
    return prisma.connectedAccount.findFirst({
      where: { organizationId, provider: "TWILIO" },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findByAccountSid(accountSid: string) {
    return prisma.connectedAccount.findFirst({
      where: {
        provider: "TWILIO",
        externalAccountId: accountSid,
        status: "ACTIVE",
      },
    });
  },

  toSummary(account: ConnectedAccount): TwilioAccountSummary {
    const meta = parseTwilioMetadata(account.metadata);
    return {
      id: account.id,
      accountSid: account.externalAccountId,
      smsPhoneNumber: account.accountEmail,
      whatsappPhoneNumber: meta.whatsappPhoneNumber ?? null,
      status: account.status,
      webhookUrl: getTwilioWebhookUrl(),
    };
  },

  async upsertFromCredentials(params: {
    organizationId: string;
    userId: string;
    accountSid: string;
    authToken: string;
    smsPhoneNumber: string;
    whatsappPhoneNumber?: string;
    friendlyName?: string;
  }) {
    const normalizedSms = normalizePhone(params.smsPhoneNumber);
    const normalizedWa = params.whatsappPhoneNumber
      ? normalizePhone(params.whatsappPhoneNumber)
      : undefined;

    const metadata: TwilioAccountMetadata = {
      friendlyName: params.friendlyName,
      ...(normalizedWa ? { whatsappPhoneNumber: normalizedWa } : {}),
    };

    const data: Prisma.ConnectedAccountCreateInput = {
      organization: { connect: { id: params.organizationId } },
      user: { connect: { id: params.userId } },
      provider: "TWILIO",
      status: "ACTIVE",
      accountEmail: normalizedSms,
      externalAccountId: params.accountSid.trim(),
      encryptedAccessToken: encryptSecret(params.authToken.trim()),
      syncStatus: "IDLE",
      syncError: null,
      metadata: metadata as unknown as Prisma.InputJsonValue,
    };

    const existing = await prisma.connectedAccount.findFirst({
      where: { organizationId: params.organizationId, provider: "TWILIO" },
    });

    if (existing) {
      return prisma.connectedAccount.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          accountEmail: normalizedSms,
          externalAccountId: params.accountSid.trim(),
          encryptedAccessToken: data.encryptedAccessToken,
          syncError: null,
          metadata: metadata as unknown as Prisma.InputJsonValue,
          user: { connect: { id: params.userId } },
        },
      });
    }

    return prisma.connectedAccount.create({ data });
  },

  async getDecryptedAuthToken(account: ConnectedAccount): Promise<string> {
    if (!account.encryptedAccessToken) {
      throw new Error("Twilio account has no auth token");
    }
    return decryptSecret(account.encryptedAccessToken);
  },

  getSmsFromNumber(account: ConnectedAccount): string {
    return account.accountEmail;
  },

  getWhatsAppFromNumber(account: ConnectedAccount): string | null {
    return parseTwilioMetadata(account.metadata).whatsappPhoneNumber ?? null;
  },

  async disconnect(accountId: string) {
    return prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: "DISCONNECTED",
        encryptedAccessToken: null,
        syncStatus: "IDLE",
      },
    });
  },
};

export function normalizePhone(phone: string): string {
  const trimmed = phone.replace(/\s/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return `+${digits}`;
}

export function twilioWhatsAppAddress(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized.startsWith("whatsapp:")
    ? normalized
    : `whatsapp:${normalized}`;
}
