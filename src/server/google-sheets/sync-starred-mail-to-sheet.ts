import { gmailRepository } from "@/server/repositories/gmail.repository";
import { syncSheetExportFull } from "@/server/google-sheets/sync-sheet-export-full";

/**
 * Ensure Gmail trigger is starred-only (when requested), then pull starred mail,
 * AI-extract into the table, and write rows to the Google Sheet via Sheets API.
 */
export async function syncStarredMailToSheet(params: {
  organizationId: string;
  exportId: string;
  starredOnly?: boolean;
}): Promise<{
  rowCount: number;
  messagesFetched: number;
  extracted: number;
}> {
  if (params.starredOnly !== false) {
    const account = await gmailRepository.findGmailAccount(params.organizationId);
    if (account) {
      await gmailRepository.updateTriggerFilters(account.id, {
        filterIds: ["STARRED"],
        mode: "any",
      });
      // Force a full starred search instead of incremental history from an old inbox sync.
      await gmailRepository.updateSyncState(account.id, {
        gmailHistoryId: null,
      });
    }
  }

  const result = await syncSheetExportFull({
    organizationId: params.organizationId,
    exportId: params.exportId,
  });

  return {
    rowCount: result.rowCount,
    messagesFetched: result.messagesFetched,
    extracted: result.extraction.succeeded,
  };
}
