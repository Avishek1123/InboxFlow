import type { ApiResponse } from "@/types";
import type {
  ExtractionColumn,
  ExtractionTableRecord,
  ExtractionTableRowRecord,
} from "@/types/extraction-table";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if ("error" in json) throw new Error(json.error.message);
  return json.data;
}

export const extractionTableClient = {
  list() {
    return request<{ items: ExtractionTableRecord[] }>(
      "/api/v1/extraction-tables"
    );
  },

  get(id: string) {
    return request<{
      table: ExtractionTableRecord;
      rows: ExtractionTableRowRecord[];
    }>(`/api/v1/extraction-tables/${id}`);
  },

  create(body: {
    name: string;
    description?: string;
    columns: Array<{ label: string; hint?: string }>;
  }) {
    return request<{ item: ExtractionTableRecord }>(
      "/api/v1/extraction-tables",
      { method: "POST", body: JSON.stringify(body) }
    );
  },

  update(
    id: string,
    body: {
      name?: string;
      description?: string;
      columns?: ExtractionColumn[];
    }
  ) {
    return request<{ table: ExtractionTableRecord }>(
      `/api/v1/extraction-tables/${id}`,
      { method: "PATCH", body: JSON.stringify(body) }
    );
  },

  delete(id: string) {
    return request<{ deleted: boolean }>(
      `/api/v1/extraction-tables/${id}`,
      { method: "DELETE" }
    );
  },

  deleteRow(tableId: string, rowId: string) {
    return request<{ deleted: boolean }>(
      `/api/v1/extraction-tables/${tableId}/rows/${rowId}`,
      { method: "DELETE" }
    );
  },

  clearRows(tableId: string) {
    return request<{ deleted: number }>(
      `/api/v1/extraction-tables/${tableId}/rows`,
      { method: "DELETE" }
    );
  },

  extractFromInbox(id: string, options?: { forceRefresh?: boolean; limit?: number }) {
    return request<{
      processed: number;
      succeeded: number;
      failed: number;
      rows: ExtractionTableRowRecord[];
    }>(`/api/v1/extraction-tables/${id}/extract`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
  },
};
