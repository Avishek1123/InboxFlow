import { google } from "googleapis";
import { DEFAULT_SHEET_SYNC_GMAIL_FILTER } from "@/lib/sheet-sync/gmail-filter";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { writePayloadToSpreadsheet } from "@/server/google-sheets/write-sheet-data";
import { buildSheetSyncPayload } from "@/server/sheet-sync/build-export-payload";
import { prisma } from "@/server/db";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";

export type SheetExportSyncResult = {
  exportId: string;
  ok: boolean;
  rowCount?: number;
  error?: string;
};

/** Push all linked Google Sheets for an organization (server-side, no Apps Script). */
export async function syncAllSheetExportsForOrganization(
  organizationId: string
): Promise<SheetExportSyncResult[]> {
  const exports = await prisma.sheetExport.findMany({
    where: { organizationId, spreadsheetId: { not: null } },
    select: {
      id: true,
      spreadsheetId: true,
      sheetTitle: true,
      extractionTableId: true,
    },
  });

  if (exports.length === 0) return [];

  let auth: Awaited<ReturnType<typeof ensureSheetsOAuthClient>>;
  try {
    const { account } = await getGoogleAuthClientForOrganization(organizationId);
    auth = await ensureSheetsOAuthClient(account);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail auth failed";
    return exports.map((e) => ({
      exportId: e.id,
      ok: false,
      error: message,
    }));
  }

  const sheets = google.sheets({ version: "v4", auth });
  const results: SheetExportSyncResult[] = [];

  for (const exp of exports) {
    if (!exp.spreadsheetId) continue;
    try {
      const payload = await buildSheetSyncPayload(
        exp.extractionTableId,
        organizationId,
        { gmailFilter: DEFAULT_SHEET_SYNC_GMAIL_FILTER }
      );
      if (!payload) {
        results.push({ exportId: exp.id, ok: false, error: "Table not found" });
        continue;
      }
      await writePayloadToSpreadsheet(
        sheets,
        exp.spreadsheetId,
        exp.sheetTitle,
        payload
      );
      await sheetExportRepository.touchFetched(exp.id);
      results.push({ exportId: exp.id, ok: true, rowCount: payload.rowCount });
    } catch (err) {
      results.push({
        exportId: exp.id,
        ok: false,
        error: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }

  return results;
}
