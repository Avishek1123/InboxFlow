import { completeWithFallback } from "@/server/ai/router";
import { extractJsonFromResponse } from "@/server/ai/utils";
import { normalizeColumns } from "@/server/ai/custom-table-extract";
import {
  parseSheetTitleFromPrompt,
  sanitizeSheetTitle,
} from "@/lib/studio/parse-sheet-title";
import { promptRequestsStarredOnly } from "@/lib/studio/parse-starred-only";
import type { ExtractionColumn } from "@/types/extraction-table";
import { recordAiUsage } from "@/server/agent/usage";

export type StudioTaskId =
  | "plan"
  | "permissions"
  | "create_table"
  | "collect_data"
  | "create_sheet"
  | "enable_autosync"
  | "activate";

export type StudioProductPlan = {
  name: string;
  description: string;
  sheetTitle: string;
  syncMinutes: number;
  starredOnly: boolean;
  /** True when the user listed explicit column headings in the prompt. */
  columnsFromUser: boolean;
  columns: ExtractionColumn[];
  triggerType: string;
  needsSheet: boolean;
  tasks: StudioTaskId[];
};

function parseColumnsFromPrompt(prompt: string): ExtractionColumn[] | null {
  const labeled = prompt.match(
    /(?:columns?|headings?|headers?|fields?)\s*(?:are|:|=)\s*([^\n.]+)/i
  );
  if (labeled?.[1]) {
    const parts = labeled[1]
      .split(/,|•|\||;| and /i)
      .map((s) => s.replace(/^[\s*"'`]+|[\s*"'`]+$/g, "").trim())
      .filter((s) => s.length > 0 && s.length < 80);
    if (parts.length >= 1) {
      return normalizeColumns(parts.map((label) => ({ label })));
    }
  }

  const bulletBlock = prompt.match(
    /(?:columns?|headings?|headers?)\s*:?\s*((?:\n\s*[-*•].+)+)/i
  );
  if (bulletBlock?.[1]) {
    const parts = bulletBlock[1]
      .split(/\n/)
      .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
      .filter(Boolean);
    if (parts.length >= 1) {
      return normalizeColumns(parts.map((label) => ({ label })));
    }
  }

  return null;
}

function defaultColumnsForPrompt(prompt: string): ExtractionColumn[] {
  const starred = promptRequestsStarredOnly(prompt);
  if (starred || /email|gmail|inbox/i.test(prompt)) {
    return normalizeColumns([
      { label: "Name", hint: "Person or company name from the email" },
      { label: "Email", hint: "Sender or contact email if present" },
      { label: "Phone Number", hint: "Phone if mentioned" },
      { label: "Summary", hint: "One-line summary of the email" },
    ]);
  }
  return normalizeColumns([
    { label: "Name", hint: "Contact name" },
    { label: "Phone Number", hint: "Phone number" },
    { label: "Details", hint: "Key details from the message" },
  ]);
}

function buildTaskList(plan: {
  needsSheet: boolean;
  needsGmail: boolean;
}): StudioTaskId[] {
  const tasks: StudioTaskId[] = ["plan"];
  // Access first → collect data → create sheet → user enables autosync → activate
  if (plan.needsGmail || plan.needsSheet) tasks.push("permissions");
  if (plan.needsSheet) {
    tasks.push(
      "create_table",
      "collect_data",
      "create_sheet",
      "enable_autosync"
    );
  }
  tasks.push("activate");
  return tasks;
}

/**
 * Turn a user prompt into an executable product plan:
 * sheet name, sync interval, columns (from user or AI), and ordered tasks.
 */
export async function planStudioProduct(params: {
  organizationId: string;
  prompt: string;
  syncIntervalMinutes?: number;
}): Promise<StudioProductPlan> {
  const prompt = params.prompt.trim();
  const userColumns = parseColumnsFromPrompt(prompt);
  const starredOnly = promptRequestsStarredOnly(prompt);
  const parsedTitle = parseSheetTitleFromPrompt(prompt);

  const completion = await completeWithFallback({
    messages: [
      {
        role: "system",
        content: `You plan an InboxFlow product from a user prompt. Return ONLY JSON:
{
  "name": string,
  "description": string,
  "sheetTitle": string | null,
  "sheetSyncMinutes": number | null,
  "starredOnly": boolean,
  "needsSheet": boolean,
  "needsGmail": boolean,
  "triggerType": "NEW_GMAIL_EMAIL" | "NEW_WHATSAPP_MESSAGE" | "NEW_SMS" | "SCHEDULED_TIME",
  "columnsFromUser": boolean,
  "columns": [{"label": string, "hint": string}]
}

Rules:
- If the user listed column/heading names, set columnsFromUser=true and use EXACTLY those labels (preserve wording).
- If the user did NOT list columns but asked for a sheet from emails, invent 3–6 useful columns and set columnsFromUser=false. Prefer Name, Email, Phone Number, Company, Summary when relevant.
- starredOnly=true when they say starred / is:starred / star emails.
- needsSheet=true when they want a Google Sheet / spreadsheet / table export.
- sheetSyncMinutes: 1–60 when they ask for auto sync/fetch/update interval (e.g. every 1 min → 1).
- sheetTitle: only if they named the sheet; else null.
- Keep column labels short (1–4 words).`,
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.15,
    maxTokens: 1800,
    jsonMode: true,
  });

  await recordAiUsage({
    organizationId: params.organizationId,
    provider: completion.provider,
    model: completion.model,
    inputTokens: completion.inputTokens,
    outputTokens: completion.outputTokens,
  });

  const parsed = JSON.parse(extractJsonFromResponse(completion.content)) as {
    name?: string;
    description?: string;
    sheetTitle?: string | null;
    sheetSyncMinutes?: number | null;
    starredOnly?: boolean;
    needsSheet?: boolean;
    needsGmail?: boolean;
    triggerType?: string;
    columnsFromUser?: boolean;
    columns?: Array<{ label?: string; hint?: string }>;
  };

  let columns: ExtractionColumn[];
  let columnsFromUser: boolean;

  if (userColumns?.length) {
    columns = userColumns;
    columnsFromUser = true;
  } else if (parsed.columnsFromUser && parsed.columns?.length) {
    columns = normalizeColumns(
      parsed.columns
        .filter((c) => c.label?.trim())
        .map((c) => ({ label: c.label!.trim(), hint: c.hint }))
    );
    columnsFromUser = true;
  } else if (parsed.columns?.length) {
    columns = normalizeColumns(
      parsed.columns
        .filter((c) => c.label?.trim())
        .map((c) => ({ label: c.label!.trim(), hint: c.hint }))
    );
    columnsFromUser = false;
  } else {
    columns = defaultColumnsForPrompt(prompt);
    columnsFromUser = false;
  }

  // Studio products always arm a 1‑minute Apps Script timer (website permissions).
  const syncMinutes = 1;

  const sheetTitle =
    sanitizeSheetTitle(parsed.sheetTitle || "") ||
    parsedTitle ||
    sanitizeSheetTitle(parsed.name || "") ||
    "InboxFlow Export";

  const needsSheet = parsed.needsSheet !== false;
  const needsGmail =
    parsed.needsGmail !== false ||
    starredOnly ||
    /gmail|email|starred/i.test(prompt);

  const tasks = buildTaskList({ needsSheet, needsGmail });

  return {
    name: (parsed.name || sheetTitle || "InboxFlow product").slice(0, 120),
    description:
      parsed.description ||
      `Collect starred Gmail into Google Sheet "${sheetTitle}" — Apps Script sync every 1 min.`,
    sheetTitle,
    syncMinutes,
    starredOnly: Boolean(parsed.starredOnly) || starredOnly,
    columnsFromUser,
    columns,
    triggerType: parsed.triggerType || "NEW_GMAIL_EMAIL",
    needsSheet,
    tasks,
  };
}
