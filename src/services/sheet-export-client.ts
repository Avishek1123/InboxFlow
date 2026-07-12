import type { ApiResponse } from "@/types";
import type {
  SheetExportCreateResult,
  SheetExportRecord,
} from "@/types/sheet-export";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if ("error" in json) throw new Error(json.error.message);
  return json.data;
}

export const sheetExportClient = {
  list() {
    return request<{ items: SheetExportRecord[] }>("/api/v1/sheet-exports");
  },

  create(body: {
    extractionTableId: string;
    label?: string;
    sheetTitle?: string;
    apiBaseUrl?: string;
    triggerMinutes?: number;
  }) {
    return request<{ item: SheetExportCreateResult }>("/api/v1/sheet-exports", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  sync(id: string) {
    return request<{
      rowCount: number;
      gmailSynced: boolean;
      messagesFetched: number;
      extraction: {
        processed: number;
        succeeded: number;
        failed: number;
        rounds: number;
      };
    }>(`/api/v1/sheet-exports/${id}/sync`, {
      method: "POST",
    });
  },

  status(id: string) {
    return request<{
      lastFetchedAt: string | null;
      publicApiUrl: string;
      apiReachable: boolean;
      triggerCount: number;
      autoSyncOn: boolean;
      triggerCheckError?: string;
      sheetTriggerMinutes: number;
      usesLocaltunnel: boolean;
    }>(`/api/v1/sheet-exports/${id}/status`);
  },

  repushScript(
    id: string,
    body?: { apiBaseUrl?: string; triggerMinutes?: number }
  ) {
    return request<{
      scriptUpdated: boolean;
      rowCount: number;
      publicApiUrl: string;
      message: string;
    }>(`/api/v1/sheet-exports/${id}/repush-script`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  },

  installTrigger(id: string, options?: { repairOnly?: boolean }) {
    return request<{
      triggerInstalled: boolean;
      triggerCount: number;
      appsScriptId: string;
      spreadsheetUrl: string | null;
      scriptEditorUrl: string;
      message: string;
      reason?: string;
      errorMessage?: string;
    }>(`/api/v1/sheet-exports/${id}/install-trigger`, {
      method: "POST",
      body: JSON.stringify({
        repairOnly: options?.repairOnly ?? true,
      }),
    });
  },

  delete(id: string) {
    return request<{ deleted: boolean }>(`/api/v1/sheet-exports/${id}`, {
      method: "DELETE",
    });
  },
};
