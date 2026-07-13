import { randomUUID } from "crypto";
import type { ConnectedAccount } from "@prisma/client";
import { getGmailSyncConfig } from "@/lib/gmail/config";
import { isGoogleNotFoundError } from "@/lib/gmail/google-api-errors";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import {
  buildSyncQuery,
  getTriggerSettings,
  labelIdsFromFilterIds,
  messageMatchesTriggerFilters,
} from "@/lib/gmail/trigger-filters";
import { automationDispatcher } from "@/server/automation/dispatcher";
import { runPostGmailSyncPipeline } from "@/server/sync-pipeline/post-gmail-sync";
import { prisma } from "@/server/db";
import { getGmailClientForAccount } from "@/server/gmail/client";
import { parseGmailMessage } from "@/server/gmail/parse-message";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";
import type { GmailSyncStats } from "@/types/gmail";

export type SyncResult = {
  accountId: string;
  stats: GmailSyncStats;
  newMessageIds: string[];
  pipelineRan: boolean;
};

export async function syncGmailAccount(
  account: ConnectedAccount,
  options?: { bypassLock?: boolean }
): Promise<SyncResult> {
  const { batchSize, lockTtlMinutes } = getGmailSyncConfig();
  const lockId = randomUUID();
  const lockExpiry = new Date(Date.now() - lockTtlMinutes * 60 * 1000);

  if (
    !options?.bypassLock &&
    account.syncLockedAt &&
    account.syncLockedAt > lockExpiry &&
    account.syncLockId
  ) {
    // Soft-skip: concurrent studio/sheet pushes must not fail the whole request.
    return {
      accountId: account.id,
      stats: {
        messagesFetched: 0,
        messagesCreated: 0,
        messagesSkipped: 0,
        attachmentsStored: 0,
        attachmentsFailed: 0,
      },
      newMessageIds: [],
      pipelineRan: false,
    };
  }

  // Studio / Sync now: clear a stuck lock so starred mail can be imported.
  if (options?.bypassLock) {
    await gmailRepository.updateSyncState(account.id, {
      syncLockedAt: null,
      syncLockId: null,
      syncStatus: "IDLE",
    });
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
  const pipelineMessageIds: string[] = [];
  const triggerSettings = getTriggerSettings(account.metadata);

  try {
    const gmail = await getGmailClientForAccount(account);
    const { backfillMax } = getGmailSyncConfig();
    const collected = await collectMessageIds(gmail, account, backfillMax);
    const externalIds = collected.externalIds;
    stats.messagesFetched = externalIds.length;

    for (const externalId of externalIds) {
      const outcome = await ingestGmailMessage({
        gmail,
        account,
        externalId,
        triggerSettings,
        stats,
      });
      if (outcome.pipelineMessageId) {
        pipelineMessageIds.push(outcome.pipelineMessageId);
      }
      if (outcome.created) {
        newMessageIds.push(outcome.pipelineMessageId!);
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

    const pipelineConfig = getSyncPipelineConfig();
    let pipelineRan = false;
    const linkedSheets =
      (await sheetExportRepository.list(account.organizationId)).length > 0;
    if (
      pipelineConfig.enabled &&
      linkedSheets &&
      (pipelineMessageIds.length > 0 || stats.messagesFetched > 0)
    ) {
      try {
        await runPostGmailSyncPipeline(account.organizationId, {
          extractLimit: pipelineConfig.extractLimit,
          messageIds: pipelineMessageIds,
        });
        pipelineRan = true;
      } catch (pipeErr) {
        console.error("[gmail/sync] post-sync pipeline", pipeErr);
      }
    }

    return { accountId: account.id, stats, newMessageIds, pipelineRan };
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

function parseStoredLabels(labels: unknown): string[] {
  if (Array.isArray(labels)) {
    return labels.filter((l): l is string => typeof l === "string");
  }
  return [];
}

function newlyMatchesTriggerFilters(
  previousLabels: unknown,
  nextLabels: string[],
  settings: ReturnType<typeof getTriggerSettings>
): boolean {
  const was = messageMatchesTriggerFilters(parseStoredLabels(previousLabels), settings);
  const now = messageMatchesTriggerFilters(nextLabels, settings);
  return now && !was;
}

async function ingestGmailMessage(params: {
  gmail: Awaited<ReturnType<typeof getGmailClientForAccount>>;
  account: ConnectedAccount;
  externalId: string;
  triggerSettings: ReturnType<typeof getTriggerSettings>;
  stats: GmailSyncStats;
}): Promise<{ created: boolean; pipelineMessageId?: string }> {
  const { gmail, account, externalId, triggerSettings, stats } = params;

  const existing = await prisma.message.findUnique({
    where: {
      connectedAccountId_externalId: {
        connectedAccountId: account.id,
        externalId,
      },
    },
  });

  let res;
  try {
    res = await gmail.users.messages.get({
      userId: "me",
      id: externalId,
      format: "full",
    });
  } catch (err) {
    if (isGoogleNotFoundError(err)) {
      stats.messagesSkipped += 1;
      if (existing) {
        await prisma.message.delete({ where: { id: existing.id } }).catch(() => {});
      }
      return { created: false };
    }
    throw err;
  }

  const parsed = parseGmailMessage(res.data);
  if (!parsed) {
    stats.messagesSkipped += 1;
    return { created: false };
  }

  if (existing) {
    const labelsChanged =
      JSON.stringify(parseStoredLabels(existing.labels)) !==
      JSON.stringify(parsed.labels);

    if (labelsChanged) {
      await prisma.message.update({
        where: { id: existing.id },
        data: { labels: parsed.labels },
      });
    }

    const nowMatches = messageMatchesTriggerFilters(
      parsed.labels,
      triggerSettings
    );
    if (nowMatches) {
      const triggerFired =
        labelsChanged ||
        newlyMatchesTriggerFilters(
          existing.labels,
          parsed.labels,
          triggerSettings
        );
      const needsExtraction = await messageNeedsLinkedTableExtraction(
        account.organizationId,
        existing.id
      );
      if (triggerFired || needsExtraction) {
        return { created: false, pipelineMessageId: existing.id };
      }
    }

    stats.messagesSkipped += 1;
    return { created: false };
  }

  if (!messageMatchesTriggerFilters(parsed.labels, triggerSettings)) {
    stats.messagesSkipped += 1;
    return { created: false };
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

  return { created: true, pipelineMessageId: message.id };
}

async function messageNeedsLinkedTableExtraction(
  organizationId: string,
  messageId: string
): Promise<boolean> {
  const exports = await prisma.sheetExport.findMany({
    where: { organizationId },
    select: { extractionTableId: true },
    distinct: ["extractionTableId"],
  });
  if (exports.length === 0) return false;

  const tableIds = exports.map((e) => e.extractionTableId);
  const rowCount = await prisma.extractionTableRow.count({
    where: { messageId, tableId: { in: tableIds }, organizationId },
  });
  return rowCount < tableIds.length;
}

async function collectMessageIds(
  gmail: Awaited<ReturnType<typeof getGmailClientForAccount>>,
  account: ConnectedAccount,
  maxIds: number
): Promise<{ externalIds: string[] }> {
  const settings = getTriggerSettings(account.metadata);
  const watchedLabels = labelIdsFromFilterIds(settings.filterIds);
  const q = buildSyncQuery(settings);
  const allIds = new Set<string>();

  let pageToken: string | undefined;
  while (allIds.size < maxIds) {
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: Math.min(100, maxIds - allIds.size),
      q,
      pageToken,
    });
    for (const m of list.data.messages ?? []) {
      if (m.id) allIds.add(m.id);
    }
    pageToken = list.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  if (account.gmailHistoryId) {
    try {
      let historyToken: string | undefined;
      do {
        const history = await gmail.users.history.list({
          userId: "me",
          startHistoryId: account.gmailHistoryId,
          historyTypes: ["messageAdded", "labelAdded"],
          pageToken: historyToken,
        });

        for (const h of history.data.history ?? []) {
          for (const added of h.messagesAdded ?? []) {
            if (added.message?.id) allIds.add(added.message.id);
          }
          for (const labeled of h.labelsAdded ?? []) {
            const msgId = labeled.message?.id;
            if (!msgId) continue;
            const addedLabelIds = labeled.labelIds ?? [];
            if (
              watchedLabels.length === 0 ||
              addedLabelIds.some((id) => watchedLabels.includes(id))
            ) {
              allIds.add(msgId);
            }
          }
        }
        historyToken = history.data.nextPageToken ?? undefined;
      } while (historyToken && allIds.size < maxIds);
    } catch (err) {
      if (!isGoogleNotFoundError(err)) throw err;
      // Stale historyId — fall back to search list only; cursor reset after successful sync.
      await gmailRepository.updateSyncState(account.id, { gmailHistoryId: null });
      account.gmailHistoryId = null;
    }
  }

  return { externalIds: [...allIds].slice(0, maxIds) };
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
