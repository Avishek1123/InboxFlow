import { getGmailSyncConfig } from "@/lib/gmail/config";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { populateTableFromInbox } from "@/server/extraction-tables/populate-from-inbox";

export type BackfillMissingRowsResult = {
  rounds: number;
  processed: number;
  succeeded: number;
  failed: number;
};

/**
 * Extract synced inbox messages that are not yet in this table.
 * Runs multiple rounds until no new rows succeed or maxRounds is hit.
 */
export async function backfillMissingTableRows(
  tableId: string,
  organizationId: string,
  options?: { maxRounds?: number; batchSize?: number }
): Promise<BackfillMissingRowsResult> {
  const { backfillMax } = getGmailSyncConfig();
  const { extractLimit } = getSyncPipelineConfig();
  const batchSize =
    options?.batchSize ?? Math.min(30, Math.max(extractLimit, backfillMax, 30));
  const maxRounds = options?.maxRounds ?? 3;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let rounds = 0;

  for (let round = 0; round < maxRounds; round += 1) {
    const result = await populateTableFromInbox(tableId, organizationId, {
      fillMissing: true,
      limit: batchSize,
    });
    processed += result.processed;
    succeeded += result.succeeded;
    failed += result.failed;
    rounds = round + 1;
    if (result.succeeded === 0) break;
  }

  return { rounds, processed, succeeded, failed };
}
