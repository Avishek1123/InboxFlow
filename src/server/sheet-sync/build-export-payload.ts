import type { ExtractionColumn } from "@/types/extraction-table";
import {
  DEFAULT_SHEET_SYNC_GMAIL_FILTER,
  type SheetSyncGmailFilter,
} from "@/lib/sheet-sync/gmail-filter";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";
import { filterRowsForSheetSync } from "@/server/sheet-sync/filter-payload-rows";
import { prisma } from "@/server/db";

/**
 * Layout MUST match the Apps Script sheet layout (headerRow_ in apps-script.ts):
 * Message ID | <table columns> | From | Subject | Received
 * Both writers share one format so headers never fight.
 */
const ID_COLUMN = { key: "_messageId", label: "Message ID" } as const;

const META_COLUMNS = [
  { key: "_sourceFrom", label: "From" },
  { key: "_sourceSubject", label: "Subject" },
  { key: "_receivedAt", label: "Received" },
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
    ID_COLUMN.key,
    ...columns.map((c) => c.key),
    ...META_COLUMNS.map((m) => m.key),
  ];
  const headers = [
    ID_COLUMN.label,
    ...columns.map((c) => c.label),
    ...META_COLUMNS.map((m) => m.label),
  ];

  // Gmail message ids in extraction rows are internal DB ids; the sheet needs
  // the Gmail external id so the Apps Script dedupes against the same value.
  const messageIds = dataRows
    .map((r) => r.messageId)
    .filter((id): id is string => Boolean(id));
  const messages = messageIds.length
    ? await prisma.message.findMany({
        where: { organizationId, id: { in: messageIds } },
        select: { id: true, externalId: true, receivedAt: true },
      })
    : [];
  const messageById = new Map(messages.map((m) => [m.id, m]));

  const rows = dataRows.map((row) => {
    const msg = row.messageId ? messageById.get(row.messageId) : undefined;
    const out: Record<string, string> = {};
    for (const col of columns) {
      const v = row.values[col.key];
      out[col.key] =
        v === null || v === undefined ? "" : String(v);
    }
    out._messageId = msg?.externalId ?? row.messageId ?? "";
    out._sourceFrom = row.sourceFrom ?? "";
    out._sourceSubject = row.sourceSubject ?? "";
    out._receivedAt = msg?.receivedAt
      ? msg.receivedAt.toISOString()
      : row.createdAt;
    return out;
  });

  return {
    tableId: table.id,
    tableName: table.name,
    headers,
    headerKeys,
    rows: rows.map((row) => {
      const byLabel: Record<string, string> = {};
      headerKeys.forEach((key, i) => {
        byLabel[headers[i]!] = row[key] ?? "";
      });
      return byLabel;
    }),
    rowCount: rows.length,
    fetchedAt: new Date().toISOString(),
    gmailFilter,
  };
}
