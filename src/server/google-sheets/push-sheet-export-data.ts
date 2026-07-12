import { google } from "googleapis";
import { DEFAULT_SHEET_SYNC_GMAIL_FILTER } from "@/lib/sheet-sync/gmail-filter";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { prepareSheetExportData } from "@/server/google-sheets/prepare-sheet-export-data";
import { writePayloadToSpreadsheet } from "@/server/google-sheets/write-sheet-data";
import { buildSheetSyncPayload } from "@/server/sheet-sync/build-export-payload";
import { prisma } from "@/server/db";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";

/** Push latest table rows into the linked sheet via Sheets API (works without Apps Script). */
export async function pushSheetExportDataFromServer(params: {
  organizationId: string;
  exportId: string;
  skipPrepare?: boolean;
}): Promise<{ rowCount: number }> {
  const row = await prisma.sheetExport.findFirst({
    where: { id: params.exportId, organizationId: params.organizationId },
  });
  if (!row?.spreadsheetId) {
    throw new Error("Sheet export not found");
  }

  if (!params.skipPrepare) {
    await prepareSheetExportData({
      organizationId: params.organizationId,
      extractionTableId: row.extractionTableId,
      forceGmailSync: true,
    });
  }

  const payload = await buildSheetSyncPayload(
    row.extractionTableId,
    params.organizationId,
    { gmailFilter: DEFAULT_SHEET_SYNC_GMAIL_FILTER }
  );
  if (!payload) {
    throw new Error("Extraction table not found");
  }

  const { account } = await getGoogleAuthClientForOrganization(params.organizationId);
  const auth = await ensureSheetsOAuthClient(account);
  const sheets = google.sheets({ version: "v4", auth });
  await writePayloadToSpreadsheet(
    sheets,
    row.spreadsheetId,
    row.sheetTitle,
    payload
  );
  await sheetExportRepository.touchFetched(row.id);

  return { rowCount: payload.rowCount };
}
