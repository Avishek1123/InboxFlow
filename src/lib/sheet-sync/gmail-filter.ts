/** Sheet sync includes only Gmail messages with this label when filter is "starred". */
export const SHEET_SYNC_STARRED_LABEL = "STARRED";

export type SheetSyncGmailFilter = "starred" | "all";

export const DEFAULT_SHEET_SYNC_GMAIL_FILTER: SheetSyncGmailFilter = "starred";

export function parseSheetSyncGmailFilter(
  value: string | null | undefined
): SheetSyncGmailFilter {
  if (value?.toLowerCase() === "all") return "all";
  return "starred";
}

export function sheetSyncGmailFilterLabel(filter: SheetSyncGmailFilter): string {
  return filter === "starred" ? "Starred Gmail only" : "All synced messages";
}
