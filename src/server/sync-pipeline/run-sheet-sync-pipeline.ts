import { getGmailSyncConfig } from "@/lib/gmail/config";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { populateTableFromInbox } from "@/server/extraction-tables/populate-from-inbox";
import { syncAllSheetExportsForOrganization } from "@/server/google-sheets/sync-organization-exports";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";

export type SheetSyncPipelineResult = {
  tablesProcessed: number;
  extraction: { tableId: string; succeeded: number; failed: number }[];
  sheets: Awaited<ReturnType<typeof syncAllSheetExportsForOrganization>>;
};

/**
 * AI-extract inbox messages into linked tables, then push to Google Sheets.
 * Used after Gmail sync and after each new WhatsApp inbound message.
 */
export async function runSheetSyncPipeline(
  organizationId: string,
  options?: { extractLimit?: number; messageIds?: string[] }
): Promise<SheetSyncPipelineResult | null> {
  const exports = await sheetExportRepository.list(organizationId);
  if (exports.length === 0) return null;

  const tableIds = [...new Set(exports.map((e) => e.extractionTableId))];
  const limit = options?.extractLimit ?? 30;
  const { backfillMax } = getGmailSyncConfig();
  const missingRowLimit = Math.max(limit, backfillMax);
  const pipelineMessageIds = options?.messageIds?.filter(Boolean) ?? [];
  const extraction: SheetSyncPipelineResult["extraction"] = [];

  for (const tableId of tableIds) {
    try {
      let succeeded = 0;
      let failed = 0;

      if (pipelineMessageIds.length > 0) {
        const triggered = await populateTableFromInbox(
          tableId,
          organizationId,
          {
            messageIds: pipelineMessageIds,
            forceRefresh: true,
          }
        );
        succeeded += triggered.succeeded;
        failed += triggered.failed;
      }

      const backfill = await populateTableFromInbox(tableId, organizationId, {
        limit: missingRowLimit,
        fillMissing: true,
      });
      succeeded += backfill.succeeded;
      failed += backfill.failed;

      extraction.push({ tableId, succeeded, failed });
    } catch (err) {
      console.error("[sheet-sync-pipeline] extract", tableId, err);
      extraction.push({ tableId, succeeded: 0, failed: 1 });
    }
  }

  const { sheetSyncVia } = getSyncPipelineConfig();
  const totalSucceeded = extraction.reduce((sum, e) => sum + e.succeeded, 0);
  // Always push linked sheets after a Gmail/WhatsApp pipeline run so the ready
  // product updates without waiting on Apps Script.
  const pushAfterPipeline =
    sheetSyncVia === "server" ||
    sheetSyncVia === "script" ||
    pipelineMessageIds.length > 0 ||
    totalSucceeded > 0;

  const sheets = pushAfterPipeline
    ? await syncAllSheetExportsForOrganization(organizationId)
    : [];

  return {
    tablesProcessed: tableIds.length,
    extraction,
    sheets,
  };
}
