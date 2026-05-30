import type { ConnectedAccount, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/tokens";
import {
  getTriggerSettings,
  type GmailTriggerSettings,
} from "@/lib/gmail/trigger-filters";
import type { GmailAccountSummary } from "@/types/gmail";

export const gmailRepository = {
  async findGmailAccount(organizationId: string) {
    return prisma.connectedAccount.findFirst({
      where: { organizationId, provider: "GMAIL" },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.connectedAccount.findUnique({ where: { id } });
  },

  async listActiveGmailAccounts() {
    return prisma.connectedAccount.findMany({
      where: { provider: "GMAIL", status: "ACTIVE" },
    });
  },

  toSummary(account: ConnectedAccount): GmailAccountSummary {
    return {
      id: account.id,
      accountEmail: account.accountEmail,
      status: account.status,
      syncStatus: account.syncStatus,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      syncError: account.syncError,
      triggerFilters: getTriggerSettings(account.metadata),
    };
  },

  async updateTriggerFilters(
    accountId: string,
    settings: GmailTriggerSettings
  ) {
    const account = await prisma.connectedAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new Error("Account not found");

    const metadata = {
      ...(typeof account.metadata === "object" && account.metadata
        ? account.metadata
        : {}),
      triggerFilters: settings,
    };

    return prisma.connectedAccount.update({
      where: { id: accountId },
      data: { metadata },
    });
  },

  async upsertFromOAuth(params: {
    organizationId: string;
    userId: string;
    accountEmail: string;
    externalAccountId: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: string[];
  }) {
    const data: Prisma.ConnectedAccountCreateInput = {
      organization: { connect: { id: params.organizationId } },
      user: { connect: { id: params.userId } },
      provider: "GMAIL",
      status: "ACTIVE",
      accountEmail: params.accountEmail,
      externalAccountId: params.externalAccountId,
      encryptedAccessToken: encryptSecret(params.accessToken),
      encryptedRefreshToken: params.refreshToken
        ? encryptSecret(params.refreshToken)
        : null,
      tokenExpiresAt: params.expiresAt,
      scopes: params.scopes,
      syncStatus: "IDLE",
      syncError: null,
    };

    return prisma.connectedAccount.upsert({
      where: {
        organizationId_provider_accountEmail: {
          organizationId: params.organizationId,
          provider: "GMAIL",
          accountEmail: params.accountEmail,
        },
      },
      create: data,
      update: {
        status: "ACTIVE",
        encryptedAccessToken: data.encryptedAccessToken,
        encryptedRefreshToken: data.encryptedRefreshToken,
        tokenExpiresAt: params.expiresAt,
        scopes: params.scopes,
        syncError: null,
        user: { connect: { id: params.userId } },
      },
    });
  },

  async getDecryptedTokens(account: ConnectedAccount) {
    if (!account.encryptedAccessToken) {
      throw new Error("Gmail account has no access token");
    }
    return {
      accessToken: decryptSecret(account.encryptedAccessToken),
      refreshToken: account.encryptedRefreshToken
        ? decryptSecret(account.encryptedRefreshToken)
        : null,
    };
  },

  async clearSyncedGmailData(organizationId: string) {
    const account = await this.findGmailAccount(organizationId);
    const gmailMessages = await prisma.message.findMany({
      where: { organizationId, channel: "GMAIL" },
      select: { id: true },
    });
    const messageIds = gmailMessages.map((m) => m.id);

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
        encryptedRefreshToken: null,
        syncStatus: "IDLE",
      },
    });
  },

  async updateSyncState(
    accountId: string,
    data: Prisma.ConnectedAccountUpdateInput
  ) {
    return prisma.connectedAccount.update({
      where: { id: accountId },
      data,
    });
  },
};
