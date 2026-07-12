import type { ExtractionColumn } from "@/types/extraction-table";
import {
  DEFAULT_SHEET_SYNC_GMAIL_FILTER,
  type SheetSyncGmailFilter,
} from "@/lib/sheet-sync/gmail-filter";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";
import { filterRowsForSheetSync } from "@/server/sheet-sync/filter-payload-rows";

const META_COLUMNS = [
  { key: "_sourceFrom", label: "From" },
  { key: "_sourceSubject", label: "Subject" },
  { key: "_sourceSnippet", label: "Snippet" },
  { key: "_extractedAt", label: "Extracted" },
] as const;

export type SheetSyncPayload = {
  tableId: string;
  tableName: string;
  headers: string[];
  headerKeys: string[];
  rows: Record<string, string>[];
  rowCount: number;
  fetchedAt: string;
  gmailFilter: SheetSyncGmailFilter;
};

export async function buildSheetSyncPayload(
  tableId: string,
  organizationId: string,
  options?: { gmailFilter?: SheetSyncGmailFilter }
): Promise<SheetSyncPayload | null> {
  const gmailFilter = options?.gmailFilter ?? DEFAULT_SHEET_SYNC_GMAIL_FILTER;
  const table = await extractionTableRepository.getById(tableId, organizationId);
  if (!table) return null;

  const allRows = await extractionTableRepository.listRows(tableId, organizationId);
  const dataRows = await filterRowsForSheetSync(allRows, organizationId, gmailFilter);
  const columns: ExtractionColumn[] = table.columns;
  const headerKeys = [
    ...columns.map((c) => c.key),
    ...META_COLUMNS.map((m) => m.key),
  ];
  const headers = [
    ...columns.map((c) => c.label),
    ...META_COLUMNS.map((m) => m.label),
  ];

  const rows = dataRows.map((row) => {
    const out: Record<string, string> = {};
    for (const col of columns) {
      const v = row.values[col.key];
      out[col.key] =
        v === null || v === undefined ? "" : String(v);
    }
    out._sourceFrom = row.sourceFrom ?? "";
    out._sourceSubject = row.sourceSubject ?? "";
    out._sourceSnippet = row.sourceSnippet ?? "";
    out._extractedAt = row.createdAt;
    return out;
  });

  return {
    tableId: table.id,
    tableName: table.name,
    headers,
    headerKeys,
    rows: rows.map((row) => {
      const byLabel: Record<string, string> = {};
      columns.forEach((col, i) => {
        byLabel[headers[i]!] = row[col.key] ?? "";
      });
      META_COLUMNS.forEach((meta, j) => {
        byLabel[headers[columns.length + j]!] = row[meta.key] ?? "";
      });
      return byLabel;
    }),
    rowCount: rows.length,
    fetchedAt: new Date().toISOString(),
    gmailFilter,
  };
}
