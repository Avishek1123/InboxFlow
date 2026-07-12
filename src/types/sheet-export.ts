export type SheetExportRecord = {
  id: string;
  extractionTableId: string;
  extractionTableName: string;
  label: string | null;
  sheetTitle: string;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  appsScriptId: string | null;
  syncIntervalMinutes: number;
  apiKeyPrefix: string;
  createdAt: string;
  updatedAt: string;
  lastFetchedAt: string | null;
};

export type SheetExportCreateResult = SheetExportRecord & {
  syncNote?: string;
  triggerInstalled?: boolean;
  triggerCount?: number;
  /** Show in-app permission step (Gmail reconnect popup), not the spreadsheet. */
  needsGooglePermissions?: boolean;
  reconnectUrl?: string;
};
