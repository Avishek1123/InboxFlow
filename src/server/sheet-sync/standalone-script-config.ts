import { prisma } from "@/server/db";
import type { AppsScriptColumn, AppsScriptConfig } from "@/lib/sheet-sync/apps-script";
import {
  buildAppsScriptConfig,
  resolveAppsScriptGeminiKey,
  resolveAppsScriptGeminiModel,
} from "@/server/sheet-sync/build-apps-script-config";

type StoredColumn = {
  key?: string;
  label?: string;
  hint?: string;
};

export async function loadAppsScriptColumnsForTable(
  tableId: string,
  organizationId: string
): Promise<AppsScriptColumn[]> {
  const table = await prisma.extractionTable.findFirst({
    where: { id: tableId, organizationId },
    select: { columns: true },
  });
  const raw = (table?.columns as StoredColumn[] | null) ?? [];
  const columns = raw
    .filter((c) => c.label?.trim())
    .map((c, i) => ({
      key: (c.key?.trim() || `col_${i}`).slice(0, 48),
      label: c.label!.trim(),
      hint: c.hint?.trim() || undefined,
    }));

  if (columns.length === 0) {
    return [
      { key: "name", label: "Name" },
      { key: "phone_number", label: "Phone Number" },
    ];
  }
  return columns;
}

/** Standalone Gmail → Gemini → sheet script config (no InboxFlow server). */
export async function buildStandaloneAppsScriptConfig(params: {
  organizationId: string;
  tableId: string;
  sheetTitle: string;
  triggerMinutes?: number;
}): Promise<AppsScriptConfig> {
  const columns = await loadAppsScriptColumnsForTable(
    params.tableId,
    params.organizationId
  );
  return buildAppsScriptConfig({
    sheetTitle: params.sheetTitle,
    columns,
    geminiApiKey: resolveAppsScriptGeminiKey(),
    geminiModel: resolveAppsScriptGeminiModel(),
    triggerMinutes: params.triggerMinutes,
    tableId: params.tableId,
  });
}
