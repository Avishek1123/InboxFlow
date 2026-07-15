import { prisma } from "@/server/db";
import type { AppsScriptColumn, AppsScriptConfig } from "@/lib/sheet-sync/apps-script";

type StoredColumn = {
  key?: string;
  label?: string;
  hint?: string;
};

/** Resolve Groq key for embedding into Apps Script at install time. */
export function resolveAppsScriptGroqKey(): string {
  const key =
    process.env.APPS_SCRIPT_GROQ_API_KEY?.trim() ||
    process.env.GROQ_API_KEY_2?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    "";
  if (!key) {
    throw new Error(
      "Set GROQ_API_KEY / GROQ_API_KEY_2 (or APPS_SCRIPT_GROQ_API_KEY) so the sheet script can structure emails with AI."
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

/** Standalone Gmail → Groq → sheet script config (no InboxFlow server calls). */
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
  return {
    sheetTitle: params.sheetTitle,
    columns,
    groqApiKey: resolveAppsScriptGroqKey(),
    groqModel: resolveAppsScriptGroqModel(),
    triggerMinutes: params.triggerMinutes,
    maxThreads: 30,
  };
}
