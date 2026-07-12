import { pushSheetExportDataFromServer } from "@/server/google-sheets/push-sheet-export-data";
import { prepareSheetExportData } from "@/server/google-sheets/prepare-sheet-export-data";
import { prisma } from "@/server/db";

export type FullSheetSyncResult = {
  rowCount: number;
  gmailSynced: boolean;
  messagesFetched: number;
  extraction: {
    processed: number;
    succeeded: number;
    failed: number;
    rounds: number;
  };
};

/**
 * Full sheet sync: pull matching Gmail into InboxFlow, AI-extract missing rows,
 * then write all table rows to the linked Google Sheet.
 */
export async function syncSheetExportFull(params: {
  organizationId: string;
  exportId: string;
}): Promise<FullSheetSyncResult> {
  const row = await prisma.sheetExport.findFirst({
    where: { id: params.exportId, organizationId: params.organizationId },
  });
  if (!row?.spreadsheetId) {
    throw new Error("Sheet export not found");
  }

  const prepared = await prepareSheetExportData({
    organizationId: params.organizationId,
    extractionTableId: row.extractionTableId,
    forceGmailSync: true,
  });

  const { rowCount } = await pushSheetExportDataFromServer({
    organizationId: params.organizationId,
    exportId: params.exportId,
    skipPrepare: true,
  });

  return {
    rowCount,
    gmailSynced: prepared.gmailSynced,
    messagesFetched: prepared.messagesFetched,
    extraction: prepared.extraction,
  };
}
