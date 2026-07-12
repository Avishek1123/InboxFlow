import { completeWithFallback } from "@/server/ai/router";
import { extractJsonFromResponse } from "@/server/ai/utils";
import { ALL_DEFINITIONS } from "@/lib/automation/definitions";
import { validateGraph } from "@/server/automation/graph";
import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from "@/types/automation";
import { recordAiUsage } from "./usage";

function catalogText() {
  return ALL_DEFINITIONS.filter((d) => !d.hidden)
    .map((d) => `${d.type}:${d.kind} — ${d.label}: ${d.description}`)
    .join("\n");
}

export async function generateWorkflowFromPrompt(params: {
  organizationId: string;
  prompt: string;
  name?: string;
}): Promise<{
  name: string;
  description: string;
  graph: WorkflowGraph;
  triggerType: string;
  validation: { valid: boolean; errors: string[] };
  sheetSyncMinutes: number | null;
  /** Explicit Google Spreadsheet title when the user named the sheet. */
  sheetTitle: string | null;
}> {
  const completion = await completeWithFallback({
    messages: [
      {
        role: "system",
        content: `You generate InboxFlow automation graphs as JSON.
Return ONLY JSON:
{
  "name": string,
  "description": string,
  "triggerType": one of NEW_GMAIL_EMAIL|NEW_WHATSAPP_MESSAGE|NEW_SMS|SCHEDULED_TIME|AI_EXTRACTION_COMPLETED,
  "nodes": [{"id":"t1","type":"trigger"|"action","position":{"x":number,"y":number},"data":{"kind":string,"label":string,"config":{}}}],
  "edges": [{"id":"e1","source":"t1","target":"a1"}]
}

Available node kinds:
${catalogText()}

Rules:
- Include exactly one primary trigger and at least one action.
- Prefer MESSAGE_RECEIVED or NEW_GMAIL_EMAIL for inbound.
- If the user says starred / is:starred / only starred emails, set the Gmail trigger config to {"filterPresetIds":["STARRED"],"filterMode":"any"} and do not include INBOX.
- Use RUN_AGENT for open-ended goals, REQUEST_APPROVAL before customer sends.
- Use EXTRACT_TO_TABLE / SHEETS_UPSERT for sheet pipelines.
- If the user asks for a sync/timer interval (e.g. every 5 minutes), set "sheetSyncMinutes" to that number (1-60). Convert seconds to whole minutes (minimum 1).
- If the user names the Google Sheet / spreadsheet (e.g. "named Lead Tracker", "call the sheet Sales Pipeline"), set "sheetTitle" to that exact name (no "InboxFlow" suffix). Otherwise sheetTitle = null.
- "name" is the automation title; do not invent a fancy sheetTitle unless the user clearly named the sheet.
- For recurring schedules use SCHEDULED_TIME with cronExpression in the trigger config when appropriate.
- Keep ids short (t1, a1, a2...).

Also include top-level:
"sheetSyncMinutes": number | null,
"sheetTitle": string | null
`,
      },
      { role: "user", content: params.prompt },
    ],
    temperature: 0.2,
    maxTokens: 2500,
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
    triggerType?: string;
    sheetSyncMinutes?: number | null;
    sheetTitle?: string | null;
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
  };

  const nodes = (parsed.nodes ?? []).map((n, i) => ({
    ...n,
    id: n.id || `n${i + 1}`,
    position: n.position ?? { x: 120 + (i % 3) * 260, y: 80 + Math.floor(i / 3) * 160 },
    data: {
      kind: n.data?.kind,
      label: n.data?.label || String(n.data?.kind ?? "Node"),
      config: n.data?.config ?? {},
    },
  })) as WorkflowNode[];

  const edges = (parsed.edges ?? []).map((e, i) => ({
    id: e.id || `e${i + 1}`,
    source: e.source,
    target: e.target,
  }));

  const graph: WorkflowGraph = { nodes, edges };
  const validation = validateGraph(graph);

  const triggerNode = nodes.find((n) => n.type === "trigger");
  const triggerType =
    parsed.triggerType ||
    (triggerNode?.data.kind as string) ||
    "NEW_GMAIL_EMAIL";

  const rawSync =
    typeof parsed.sheetSyncMinutes === "number" &&
    Number.isFinite(parsed.sheetSyncMinutes)
      ? Math.max(1, Math.min(60, Math.round(parsed.sheetSyncMinutes)))
      : null;

  const rawSheetTitle =
    typeof parsed.sheetTitle === "string" && parsed.sheetTitle.trim()
      ? parsed.sheetTitle.trim().slice(0, 100)
      : null;

  return {
    name: parsed.name || params.name || "Generated automation",
    description: parsed.description || params.prompt.slice(0, 200),
    graph,
    triggerType,
    validation: { valid: validation.valid, errors: validation.errors },
    sheetSyncMinutes: rawSync,
    sheetTitle: rawSheetTitle,
  };
}
