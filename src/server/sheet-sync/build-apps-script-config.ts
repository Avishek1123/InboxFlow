import type { AppsScriptColumn, AppsScriptConfig } from "@/lib/sheet-sync/apps-script";

export function buildAppsScriptConfig(params: {
  sheetTitle: string;
  columns: AppsScriptColumn[];
  groqApiKey: string;
  groqModel?: string;
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
    groqApiKey: params.groqApiKey,
    groqModel: params.groqModel,
    triggerMinutes: params.triggerMinutes,
    maxThreads: params.maxThreads,
    apiBaseUrl: params.apiBaseUrl,
    apiKey: params.apiKey,
    tableId: params.tableId,
  };
}

/** Resolve Groq key for embedding into Apps Script at install time. */
export function resolveAppsScriptGroqKey(): string {
  const key =
    process.env.APPS_SCRIPT_GROQ_API_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    "";
  if (!key) {
    throw new Error(
      "Set GROQ_API_KEY (or APPS_SCRIPT_GROQ_API_KEY) so the sheet script can structure emails with AI."
    );
  }
  return key;
}

export function resolveAppsScriptGroqModel(): string {
  return (
    process.env.APPS_SCRIPT_GROQ_MODEL?.trim() ||
    process.env.GROQ_MODEL?.trim() ||
    "llama-3.1-8b-instant"
  );
}

/** @deprecated use resolveAppsScriptGroqKey */
export function resolveAppsScriptGeminiKey(): string {
  return resolveAppsScriptGroqKey();
}

/** @deprecated use resolveAppsScriptGroqModel */
export function resolveAppsScriptGeminiModel(): string {
  return resolveAppsScriptGroqModel();
}
