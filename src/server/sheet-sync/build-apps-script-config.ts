import {
  DEFAULT_SHEET_SYNC_GMAIL_FILTER,
  type SheetSyncGmailFilter,
} from "@/lib/sheet-sync/gmail-filter";
import type { AppsScriptConfig } from "@/lib/sheet-sync/apps-script";

export function buildAppsScriptConfig(params: {
  apiBaseUrl: string;
  apiKey: string;
  tableId: string;
  sheetTitle: string;
  triggerMinutes?: number;
  gmailFilter?: SheetSyncGmailFilter;
}): AppsScriptConfig {
  return {
    apiBaseUrl: params.apiBaseUrl,
    apiKey: params.apiKey,
    tableId: params.tableId,
    sheetTitle: params.sheetTitle,
    triggerMinutes: params.triggerMinutes,
    gmailFilter: params.gmailFilter ?? DEFAULT_SHEET_SYNC_GMAIL_FILTER,
  };
}
