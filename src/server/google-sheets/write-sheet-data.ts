import type { sheets_v4 } from "googleapis";
import type { SheetSyncPayload } from "@/server/sheet-sync/build-export-payload";

export async function writePayloadToSpreadsheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  payload: SheetSyncPayload
) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheet = meta.data.sheets?.[0];
  const sheetId = firstSheet?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, title: sheetTitle },
            fields: "title",
          },
        },
      ],
    },
  });

  const rows: string[][] = [payload.headers];
  for (const row of payload.rows) {
    rows.push(payload.headers.map((h) => row[h] ?? ""));
  }

  if (rows.length === 0) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle.replace(/'/g, "''")}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}
