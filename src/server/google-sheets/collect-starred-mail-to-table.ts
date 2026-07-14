import { syncGmailAccount } from "@/server/gmail/sync";
import { populateTableFromInbox } from "@/server/extraction-tables/populate-from-inbox";
import { gmailRepository } from "@/server/repositories/gmail.repository";

/**
 * Phase 1 of studio data collection: pull starred Gmail into InboxFlow.
 * Kept separate from extraction so each serverless request stays short.
 */
export async function syncStarredGmailForStudio(params: {
  organizationId: string;
  starredOnly?: boolean;
}): Promise<{ messagesFetched: number }> {
  const account = await gmailRepository.findGmailAccount(params.organizationId);
  if (!account || account.status !== "ACTIVE") {
    throw new Error("Connect Google first");
  }

  if (params.starredOnly !== false) {
    await gmailRepository.updateTriggerFilters(account.id, {
      filterIds: ["STARRED"],
      mode: "any",
    });
    await gmailRepository.updateSyncState(account.id, {
      gmailHistoryId: null,
    });
  }

  // Reload so sync uses updated filters
  const fresh = (await gmailRepository.findGmailAccount(params.organizationId))!;
  const syncResult = await syncGmailAccount(fresh, {
    bypassLock: true,
    // Keep this serverless request short; extraction runs in later requests
    // and the 1-min Apps Script timer keeps pulling anything beyond the cap.
    maxMessages: 100,
    skipPipeline: true,
  });
  return { messagesFetched: syncResult.stats.messagesFetched };
}

/**
 * Phase 2 of studio data collection: AI-extract one small batch of synced
 * messages into the table. Callers loop within their own time budget and
 * stop when `succeeded === 0` (nothing left to extract).
 */
export async function extractTableBatchForStudio(params: {
  organizationId: string;
  tableId: string;
  batchSize?: number;
}): Promise<{ processed: number; succeeded: number; failed: number }> {
  const result = await populateTableFromInbox(
    params.tableId,
    params.organizationId,
    { fillMissing: true, limit: params.batchSize ?? 10 }
  );
  return {
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
  };
}
