import { checkRateLimit } from "@/server/ai/rate-limiter";
import { completeWithFallback } from "@/server/ai/router";
import { extractJsonFromResponse } from "@/server/ai/utils";
import type { ExtractionColumn } from "@/types/extraction-table";

function slugKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || `col_${Date.now()}`;
}

export function normalizeColumns(
  columns: Array<{ label: string; hint?: string; key?: string }>
): ExtractionColumn[] {
  const seen = new Set<string>();
  return columns
    .filter((c) => c.label.trim())
    .map((c) => {
      let key = c.key?.trim() || slugKey(c.label);
      if (seen.has(key)) key = `${key}_${seen.size}`;
      seen.add(key);
      return {
        key,
        label: c.label.trim(),
        hint: c.hint?.trim() || undefined,
      };
    });
}

export async function extractCustomTableRow(params: {
  organizationId: string;
  columns: ExtractionColumn[];
  fromAddress: string;
  subject: string | null;
  body: string;
}): Promise<Record<string, string | null>> {
  checkRateLimit(params.organizationId);

  const fieldLines = params.columns
    .map((c) => {
      const hint = c.hint ? ` (${c.hint})` : "";
      return `  "${c.key}": string or null — ${c.label}${hint}`;
    })
    .join("\n");

  const system = `You extract structured data from emails. Return ONLY a valid JSON object with exactly these keys. Use null when information is missing. Do not invent data.`;

  const user = `Extract these fields from the email:

{
${fieldLines}
}

Email:
From: ${params.fromAddress}
Subject: ${params.subject ?? "(no subject)"}

${params.body.slice(0, 12000)}`;

  const completion = await completeWithFallback({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.1,
    maxTokens: 1024,
    jsonMode: true,
  });

  const jsonStr = extractJsonFromResponse(completion.content);
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  const result: Record<string, string | null> = {};
  for (const col of params.columns) {
    const v = parsed[col.key];
    if (v === null || v === undefined) {
      result[col.key] = null;
    } else if (typeof v === "object") {
      result[col.key] = JSON.stringify(v);
    } else {
      result[col.key] = String(v);
    }
  }
  return result;
}
