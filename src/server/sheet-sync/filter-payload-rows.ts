import {
  DEFAULT_SHEET_SYNC_GMAIL_FILTER,
  type SheetSyncGmailFilter,
} from "@/lib/sheet-sync/gmail-filter";
import type { ExtractionTableRowRecord } from "@/types/extraction-table";

/**
 * Sheet rows come from the extraction table, which is already filled using
 * Gmail trigger filters (e.g. starred). Keep linked rows; drop orphan rows.
 */
export async function filterRowsForSheetSync(
  rows: ExtractionTableRowRecord[],
  _organizationId: string,
  filter: SheetSyncGmailFilter = DEFAULT_SHEET_SYNC_GMAIL_FILTER
): Promise<ExtractionTableRowRecord[]> {
  if (filter === "all") return rows;
  return rows.filter((row) => Boolean(row.messageId));
}
