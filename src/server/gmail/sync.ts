import { randomUUID } from "crypto";
import type { ConnectedAccount } from "@prisma/client";
import { getGmailSyncConfig } from "@/lib/gmail/config";
import {
  buildSyncQuery,
  getTriggerSettings,
  messageMatchesTriggerFilters,
} from "@/lib/gmail/trigger-filters";
import { automationDispatcher } from "@/server/automation/dispatcher";
import { prisma } from "@/server/db";
import { getGmailClientForAccount } from "@/server/gmail/client";
import { parseGmailMessage } from "@/server/gmail/parse-message";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import type { GmailSyncStats } from "@/types/gmail";

export type SyncResult = {
  accountId: string;
  stats: GmailSyncStats;
  newMessageIds: string[];
};

export async function syncGmailAccount(
  account: ConnectedAccount
): Promise<SyncResult> {
  const { batchSize, lockTtlMinutes } = getGmailSyncConfig();
  const lockId = randomUUID();
  const lockExpiry = new Date(Date.now() - lockTtlMinutes * 60 * 1000);

  if (
    account.syncLockedAt &&
    account.syncLockedAt > lockExpiry &&
    account.syncLockId
  ) {
    throw new Error("Sync already in progress for this account");
  }

  await gmailRepository.updateSyncState(account.id, {
    syncStatus: "SYNCING",
    syncLockedAt: new Date(),
    syncLockId: lockId,
    syncError: null,
  });

  const run = await prisma.gmailSyncRun.create({
    data: {
      organizationId: account.organizationId,
      connectedAccountId: account.id,
      type: account.gmailHistoryId ? "INCREMENTAL" : "FULL",
      status: "RUNNING",
    },
  });

  const stats: GmailSyncStats = {
    messagesFetched: 0,
    messagesCreated: 0,
    messagesSkipped: 0,
    attachmentsStored: 0,
    attachmentsFailed: 0,
  };
  const newMessageIds: string[] = [];

  try {
    const gmail = await getGmailClientForAccount(account);
    const messageIds = await collectMessageIds(gmail, account, batchSize);
    stats.messagesFetched = messageIds.length;

    for (const externalId of messageIds) {
      const existing = await prisma.message.findUnique({
        where: {
          connectedAccountId_externalId: {
            connectedAccountId: account.id,
            externalId,
          },
        },
      });

      if (existing) {
        stats.messagesSkipped += 1;
        continue;
      }

      const res = await gmail.users.messages.get({
        userId: "me",
        id: externalId,
        format: "full",
      });

      const parsed = parseGmailMessage(res.data);
      if (!parsed) {
        stats.messagesSkipped += 1;
        continue;
      }

      const triggerSettings = getTriggerSettings(account.metadata);
      if (!messageMatchesTriggerFilters(parsed.labels, triggerSettings)) {
        stats.messagesSkipped += 1;
        continue;
      }

      const conversation = await prisma.conversation.upsert({
        where: {
          connectedAccountId_externalThreadId: {
            connectedAccountId: account.id,
            externalThreadId: parsed.externalThreadId,
          },
        },
        create: {
          organizationId: account.organizationId,
          connectedAccountId: account.id,
          channel: "GMAIL",
          externalThreadId: parsed.externalThreadId,
          subject: parsed.subject,
          snippet: parsed.snippet,
          participantName: parsed.fromAddress,
          participantEmails: [parsed.fromAddress],
          lastMessageAt: parsed.receivedAt,
        },
        update: {
          subject: parsed.subject ?? undefined,
          snippet: parsed.snippet ?? undefined,
          lastMessageAt: parsed.receivedAt,
        },
      });

      const message = await prisma.message.create({
        data: {
          organizationId: account.organizationId,
          conversationId: conversation.id,
          connectedAccountId: account.id,
          channel: "GMAIL",
          direction: "INBOUND",
          externalId: parsed.externalId,
          externalThreadId: parsed.externalThreadId,
          fromAddress: parsed.fromAddress,
          toAddresses: parsed.toAddresses,
          ccAddresses: parsed.ccAddresses,
          subject: parsed.subject,
          bodyText: parsed.bodyText,
          bodyHtml: parsed.bodyHtml,
          receivedAt: parsed.receivedAt,
          labels: parsed.labels,
          hasAttachments: parsed.hasAttachments,
        },
      });

      stats.messagesCreated += 1;
      newMessageIds.push(message.id);

      if (messageMatchesTriggerFilters(parsed.labels, triggerSettings)) {
        await automationDispatcher.dispatch({
          organizationId: account.organizationId,
          triggerType: "NEW_GMAIL_EMAIL",
          payload: {
            messageId: message.id,
            conversationId: conversation.id,
            channel: "GMAIL",
            from: parsed.fromAddress,
            subject: parsed.subject ?? undefined,
            body: parsed.bodyText ?? parsed.snippet ?? undefined,
            receivedAt: parsed.receivedAt.toISOString(),
            labels: parsed.labels,
          },
        });
      }
    }

    const profile = await gmail.users.getProfile({ userId: "me" });
    await gmailRepository.updateSyncState(account.id, {
      gmailHistoryId: profile.data.historyId ?? account.gmailHistoryId,
      lastSyncedAt: new Date(),
      syncStatus: "IDLE",
      syncLockedAt: null,
      syncLockId: null,
      syncError: null,
    });

    await prisma.gmailSyncRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        messagesFetched: stats.messagesFetched,
        messagesCreated: stats.messagesCreated,
        messagesSkipped: stats.messagesSkipped,
      },
    });

    return { accountId: account.id, stats, newMessageIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await gmailRepository.updateSyncState(account.id, {
      syncStatus: "ERROR",
      syncError: message,
      syncLockedAt: null,
      syncLockId: null,
    });
    await prisma.gmailSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      },
    });
    throw err;
  }
}

async function collectMessageIds(
  gmail: Awaited<ReturnType<typeof getGmailClientForAccount>>,
  account: ConnectedAccount,
  batchSize: number
): Promise<string[]> {
  const ids = new Set<string>();

  if (account.gmailHistoryId) {
    try {
      let pageToken: string | undefined;
      do {
        const history = await gmail.users.history.list({
          userId: "me",
          startHistoryId: account.gmailHistoryId,
          historyTypes: ["messageAdded"],
          pageToken,
        });

        for (const h of history.data.history ?? []) {
          for (const added of h.messagesAdded ?? []) {
            if (added.message?.id) ids.add(added.message.id);
          }
        }
        pageToken = history.data.nextPageToken ?? undefined;
      } while (pageToken && ids.size < batchSize);
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code !== 404) throw err;
    }
  }

  if (ids.size === 0) {
    const settings = getTriggerSettings(account.metadata);
    const q = buildSyncQuery(settings);
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: batchSize,
      q,
    });
    for (const m of list.data.messages ?? []) {
      if (m.id) ids.add(m.id);
    }
  }

  return [...ids].slice(0, batchSize);
}

export async function syncAllActiveGmailAccounts() {
  const accounts = await gmailRepository.listActiveGmailAccounts();
  const results: Array<{ accountId: string; ok: boolean; error?: string }> =
    [];

  for (const account of accounts) {
    try {
      await syncGmailAccount(account);
      results.push({ accountId: account.id, ok: true });
    } catch (e) {
      results.push({
        accountId: account.id,
        ok: false,
        error: e instanceof Error ? e.message : "error",
      });
    }
  }

  return results;
}
