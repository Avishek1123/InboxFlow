import type { ConnectedAccount, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto/tokens";
import { prisma } from "@/server/db";
import { getWhatsAppWebhookUrl } from "@/lib/whatsapp/config";
import type { WhatsAppAccountSummary } from "@/types/whatsapp";

export type WhatsAppAccountMetadata = {
  metaAppSecretEncrypted?: string;
  verifiedName?: string;
};

export function parseWhatsAppMetadata(metadata: unknown): WhatsAppAccountMetadata {
  if (!metadata || typeof metadata !== "object") return {};
  return metadata as WhatsAppAccountMetadata;
}

export const whatsappRepository = {
  async findWhatsAppAccount(organizationId: string) {
    return prisma.connectedAccount.findFirst({
      where: { organizationId, provider: "WHATSAPP" },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findByPhoneNumberId(phoneNumberId: string) {
    return prisma.connectedAccount.findFirst({
      where: {
        provider: "WHATSAPP",
        externalAccountId: phoneNumberId,
        status: "ACTIVE",
      },
    });
  },

  async findByWebhookVerifyToken(plainToken: string) {
    const accounts = await prisma.connectedAccount.findMany({
      where: {
        provider: "WHATSAPP",
        status: "ACTIVE",
        encryptedWebhookVerifyToken: { not: null },
      },
    });

    for (const account of accounts) {
      try {
        const stored = account.encryptedWebhookVerifyToken
          ? decryptSecret(account.encryptedWebhookVerifyToken)
          : null;
        if (stored === plainToken) return account;
      } catch {
        continue;
      }
    }
    return null;
  },

  toSummary(account: ConnectedAccount): WhatsAppAccountSummary {
    return {
      id: account.id,
      businessPhone: account.accountEmail,
      phoneNumberId: account.externalAccountId,
      whatsappBusinessAccountId: account.whatsappBusinessAccountId,
      status: account.status,
      syncStatus: account.syncStatus,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      syncError: account.syncError,
      webhookUrl: getWhatsAppWebhookUrl(),
      hasWebhookVerifyToken: Boolean(account.encryptedWebhookVerifyToken),
    };
  },

  async upsertFromCredentials(params: {
    organizationId: string;
    userId: string;
    phoneNumberId: string;
    whatsappBusinessAccountId: string;
    accessToken: string;
    businessPhone: string;
    webhookVerifyToken: string;
    metaAppId?: string;
    metaAppSecret?: string;
    verifiedName?: string;
  }) {
    const metadata: WhatsAppAccountMetadata = {
      verifiedName: params.verifiedName,
      ...(params.metaAppSecret
        ? { metaAppSecretEncrypted: encryptSecret(params.metaAppSecret) }
        : {}),
    };

    const data: Prisma.ConnectedAccountCreateInput = {
      organization: { connect: { id: params.organizationId } },
      user: { connect: { id: params.userId } },
      provider: "WHATSAPP",
      status: "ACTIVE",
      accountEmail: params.businessPhone,
      externalAccountId: params.phoneNumberId,
      whatsappBusinessAccountId: params.whatsappBusinessAccountId,
      metaAppId: params.metaAppId ?? null,
      encryptedAccessToken: encryptSecret(params.accessToken),
      encryptedWebhookVerifyToken: encryptSecret(params.webhookVerifyToken),
      syncStatus: "IDLE",
      syncError: null,
      metadata,
    };

    const existing = await prisma.connectedAccount.findFirst({
      where: {
        organizationId: params.organizationId,
        provider: "WHATSAPP",
      },
    });

    if (existing) {
      return prisma.connectedAccount.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          accountEmail: params.businessPhone,
          externalAccountId: params.phoneNumberId,
          whatsappBusinessAccountId: params.whatsappBusinessAccountId,
          encryptedAccessToken: data.encryptedAccessToken,
          encryptedWebhookVerifyToken: data.encryptedWebhookVerifyToken,
          metaAppId: params.metaAppId ?? undefined,
          syncError: null,
          metadata: metadata as unknown as Prisma.InputJsonValue,
          user: { connect: { id: params.userId } },
        },
      });
    }

    return prisma.connectedAccount.create({ data });
  },

  async getDecryptedAccessToken(account: ConnectedAccount): Promise<string> {
    if (!account.encryptedAccessToken) {
      throw new Error("WhatsApp account has no access token");
    }
    return decryptSecret(account.encryptedAccessToken);
  },

  getWebhookAppSecret(account: ConnectedAccount): string | null {
    const meta = parseWhatsAppMetadata(account.metadata);
    if (meta.metaAppSecretEncrypted) {
      return decryptSecret(meta.metaAppSecretEncrypted);
    }
    return (
      process.env.META_APP_SECRET ??
      process.env.WHATSAPP_APP_SECRET ??
      null
    );
  },

  async clearSyncedWhatsAppData(organizationId: string) {
    const account = await this.findWhatsAppAccount(organizationId);
    const waMessages = await prisma.message.findMany({
      where: { organizationId, channel: "WHATSAPP" },
      select: { id: true },
    });
    const messageIds = waMessages.map((m) => m.id);

    if (messageIds.length > 0) {
      await prisma.extractionTableRow.deleteMany({
        where: { organizationId, messageId: { in: messageIds } },
      });
      await prisma.message.deleteMany({
        where: { id: { in: messageIds } },
      });
    }

    if (account) {
      await prisma.conversation.deleteMany({
        where: { connectedAccountId: account.id },
      });
    }

    return { deletedMessages: messageIds.length };
  },

  async disconnect(accountId: string) {
    return prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: "DISCONNECTED",
        encryptedAccessToken: null,
        encryptedWebhookVerifyToken: null,
        syncStatus: "IDLE",
      },
    });
  },
};
