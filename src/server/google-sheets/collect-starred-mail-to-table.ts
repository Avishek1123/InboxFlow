import { syncGmailAccount } from "@/server/gmail/sync";
import { backfillMissingTableRows } from "@/server/extraction-tables/backfill-missing-rows";
import { gmailRepository } from "@/server/repositories/gmail.repository";

/**
 * Pull starred Gmail into InboxFlow and AI-extract into a table (no sheet required yet).
 */
export async function collectStarredMailToTable(params: {
  organizationId: string;
  tableId: string;
  starredOnly?: boolean;
}): Promise<{
  messagesFetched: number;
  extracted: number;
  processed: number;
}> {
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
  const syncResult = await syncGmailAccount(fresh, { bypassLock: true });
  const extraction = await backfillMissingTableRows(
    params.tableId,
    params.organizationId,
    { maxRounds: 8, batchSize: 40 }
  );

  return {
    messagesFetched: syncResult.stats.messagesFetched,
    extracted: extraction.succeeded,
    processed: extraction.processed,
  };
}
