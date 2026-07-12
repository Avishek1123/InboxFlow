import type { AppsScriptColumn, AppsScriptConfig } from "@/lib/sheet-sync/apps-script";

export function buildAppsScriptConfig(params: {
  sheetTitle: string;
  columns: AppsScriptColumn[];
  geminiApiKey: string;
  geminiModel?: string;
  triggerMinutes?: number;
  maxThreads?: number;
  /** @deprecated kept for call-site compatibility */
  apiBaseUrl?: string;
  apiKey?: string;
  tableId?: string;
}): AppsScriptConfig {
  return {
    sheetTitle: params.sheetTitle,
    columns: params.columns,
    geminiApiKey: params.geminiApiKey,
    geminiModel: params.geminiModel,
    triggerMinutes: params.triggerMinutes,
    maxThreads: params.maxThreads,
    apiBaseUrl: params.apiBaseUrl,
    apiKey: params.apiKey,
    tableId: params.tableId,
  };
}

/** Resolve Gemini key for embedding into Apps Script at install time. */
export function resolveAppsScriptGeminiKey(): string {
  const key =
    process.env.APPS_SCRIPT_GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    "";
  if (!key) {
    throw new Error(
      "Set GEMINI_API_KEY (or APPS_SCRIPT_GEMINI_API_KEY) so the sheet script can structure emails with AI."
    );
  }
  return key;
}

export function resolveAppsScriptGeminiModel(): string {
  return (
    process.env.APPS_SCRIPT_GEMINI_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.0-flash"
  );
}
