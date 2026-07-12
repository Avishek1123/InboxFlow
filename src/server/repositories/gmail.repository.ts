import type { ConnectedAccount, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/tokens";
import {
  currentOAuthProjectNumber,
  mergeOAuthMetadata,
} from "@/lib/gmail/oauth-metadata";
import {
  getTriggerSettings,
  type GmailTriggerSettings,
} from "@/lib/gmail/trigger-filters";
import type { GmailAccountSummary } from "@/types/gmail";

export const gmailRepository = {
  async findGmailAccount(organizationId: string) {
    const active = await prisma.connectedAccount.findFirst({
      where: { organizationId, provider: "GMAIL", status: "ACTIVE" },
    });
    if (active) return active;
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
    const oauthProjectNumber = currentOAuthProjectNumber();
    const existing = await prisma.connectedAccount.findUnique({
      where: {
        organizationId_provider_accountEmail: {
          organizationId: params.organizationId,
          provider: "GMAIL",
          accountEmail: params.accountEmail,
        },
      },
      select: { metadata: true },
    });
    const metadata = mergeOAuthMetadata(existing?.metadata, oauthProjectNumber);

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
      metadata: metadata as Prisma.InputJsonValue,
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
        syncStatus: "IDLE",
        metadata: metadata as Prisma.InputJsonValue,
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
    const account = await prisma.connectedAccount.findUnique({
      where: { id: accountId },
    });

    if (account?.encryptedAccessToken || account?.encryptedRefreshToken) {
      try {
        const { getGoogleAuthClientForAccount } = await import(
          "@/server/google/auth-client"
        );
        const auth = await getGoogleAuthClientForAccount(account);
        await auth.revokeCredentials();
      } catch {
        /* token may already be invalid */
      }
    }

    const priorMeta =
      typeof account?.metadata === "object" &&
      account.metadata !== null &&
      !Array.isArray(account.metadata)
        ? { ...(account.metadata as Record<string, unknown>) }
        : {};
    delete priorMeta.oauthProjectNumber;

    return prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: "DISCONNECTED",
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        scopes: [],
        syncStatus: "IDLE",
        syncError: null,
        metadata: priorMeta as Prisma.InputJsonValue,
      },
    });
  },

  async markReconnectRequired(accountId: string, message: string) {
    const account = await prisma.connectedAccount.findUnique({
      where: { id: accountId },
      select: { metadata: true },
    });
    const meta =
      typeof account?.metadata === "object" &&
      account.metadata !== null &&
      !Array.isArray(account.metadata)
        ? { ...(account.metadata as Record<string, unknown>) }
        : {};
    meta.reconnectRequired = true;

    return prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: "TOKEN_EXPIRED",
        syncError: message,
        metadata: meta as Prisma.InputJsonValue,
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
