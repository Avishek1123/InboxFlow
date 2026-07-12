import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { normalizeColumns } from "@/server/ai/custom-table-extract";
import { generateSheetSyncApiKey } from "@/lib/sheet-sync/api-key";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { hasGoogleSheetsScopes } from "@/lib/gmail/scopes";
import { buildGmailReconnectUrl } from "@/lib/gmail/reconnect-url";
import { parseSheetSyncMinutesFromPrompt } from "@/lib/studio/parse-sheet-sync-minutes";
import {
  parseSheetTitleFromPrompt,
  sanitizeSheetTitle,
} from "@/lib/studio/parse-sheet-title";
import { promptRequestsStarredOnly } from "@/lib/studio/parse-starred-only";
import { startDevTunnelIfEnabled } from "@/server/dev-tunnel";
import { ensureHealthyPublicAppUrl } from "@/server/dev-tunnel/ensure-healthy-public-url";
import { hasReachablePublicAppUrl } from "@/lib/app-url";
import { generateWorkflowFromPrompt } from "@/server/agent";
import { provisionGoogleSheetExport } from "@/server/google-sheets/provision-sheet";
import { installSheetExportTrigger } from "@/server/google-sheets/install-sheet-export-trigger";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { getGmailTokenHealth } from "@/server/google/gmail-token-health";
import { requireOrganization } from "@/server/organizations/require-organization";
import { automationRepository } from "@/server/repositories/automation.repository";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";
import { twilioRepository } from "@/server/repositories/twilio.repository";
import { whatsappRepository } from "@/server/repositories/whatsapp.repository";
import { getRequiredIntegration } from "@/lib/automation/integration-requirements";
import type { AutomationTriggerType } from "@prisma/client";
import type { WorkflowGraph } from "@/types/automation";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  prompt: z.string().min(8).max(4000),
  activate: z.boolean().optional().default(true),
  /** Explicit Ask AI picker — how often server keep-alive syncs Gmail → sheet. */
  syncIntervalMinutes: z.number().int().min(1).max(60).optional(),
});

function graphNeedsSheet(graph: WorkflowGraph): boolean {
  return graph.nodes.some((n) =>
    ["SHEETS_UPSERT", "EXTRACT_TO_TABLE"].includes(n.data.kind)
  );
}

function graphNeedsGmail(graph: WorkflowGraph): boolean {
  return graph.nodes.some((n) => {
    const req = getRequiredIntegration(n.data.kind, n.data.config);
    return (
      req === "GMAIL" ||
      n.data.kind === "SHEETS_UPSERT" ||
      n.data.kind === "EXTRACT_TO_TABLE" ||
      n.data.kind === "NEW_GMAIL_EMAIL" ||
      n.data.kind === "SEND_EMAIL"
    );
  });
}

function wireSheetIntoGraph(
  graph: WorkflowGraph,
  sheet: { id: string; extractionTableId: string; extractionTableName: string }
): WorkflowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (
        n.data.kind !== "SHEETS_UPSERT" &&
        n.data.kind !== "EXTRACT_TO_TABLE"
      ) {
        return n;
      }
      return {
        ...n,
        data: {
          ...n.data,
          config: {
            ...n.data.config,
            exportId: sheet.id,
            tableId: sheet.extractionTableId,
            tableName: sheet.extractionTableName,
          },
        },
      };
    }),
  };
}

/** Force Gmail trigger nodes to starred-only when the user asked for it. */
function wireStarredOnlyIntoGraph(graph: WorkflowGraph): WorkflowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (n.data.kind !== "NEW_GMAIL_EMAIL" && n.data.kind !== "MESSAGE_RECEIVED") {
        return n;
      }
      return {
        ...n,
        data: {
          ...n.data,
          config: {
            ...n.data.config,
            filterPresetIds: ["STARRED"],
            filterMode: "any",
            filterLabels: [],
          },
        },
      };
    }),
  };
}

function requiredIntegrations(graph: WorkflowGraph): Array<"GMAIL" | "WHATSAPP" | "TWILIO"> {
  const set = new Set<"GMAIL" | "WHATSAPP" | "TWILIO">();
  for (const node of graph.nodes) {
    const req = getRequiredIntegration(node.data.kind, node.data.config);
    if (req) set.add(req);
    if (
      node.data.kind === "SHEETS_UPSERT" ||
      node.data.kind === "EXTRACT_TO_TABLE"
    ) {
      set.add("GMAIL");
    }
  }
  if (graphNeedsGmail(graph)) set.add("GMAIL");
  return [...set];
}

/**
 * One-shot: prompt → workflow → permissions check → sheet link → auto-wire sync → activate.
 */
export async function POST(request: Request) {
  try {
    const { organization } = await requireOrganization();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid prompt", 400, parsed.error.flatten());
    }

    const draft = await generateWorkflowFromPrompt({
      organizationId: organization.id,
      prompt: parsed.data.prompt,
    });

    const starredOnly = promptRequestsStarredOnly(parsed.data.prompt);
    if (starredOnly) {
      draft.graph = wireStarredOnlyIntoGraph(draft.graph);
      const gmailForFilters = await gmailRepository.findGmailAccount(
        organization.id
      );
      if (gmailForFilters) {
        await gmailRepository.updateTriggerFilters(gmailForFilters.id, {
          filterIds: ["STARRED"],
          mode: "any",
        });
      }
    }

    const syncMinutes = Math.max(
      1,
      Math.min(
        60,
        parsed.data.syncIntervalMinutes ??
          draft.sheetSyncMinutes ??
          parseSheetSyncMinutesFromPrompt(parsed.data.prompt) ??
          getSyncPipelineConfig().sheetTriggerMinutes ??
          1
      )
    );

    const namedSheetTitle =
      (draft.sheetTitle && sanitizeSheetTitle(draft.sheetTitle)) ||
      parseSheetTitleFromPrompt(parsed.data.prompt);
    /** Prefer the name the user asked for; only fall back to automation name. */
    const resolvedSheetTitle =
      namedSheetTitle || sanitizeSheetTitle(draft.name) || "InboxFlow Export";

    const needed = requiredIntegrations(draft.graph);
    const gmailAccount = await gmailRepository.findGmailAccount(organization.id);
    const gmailHealth = await getGmailTokenHealth(gmailAccount);
    const gmailOk =
      Boolean(gmailAccount?.status === "ACTIVE") &&
      !gmailHealth.needsReconnect &&
      (!graphNeedsSheet(draft.graph) ||
        hasGoogleSheetsScopes(gmailAccount?.scopes));
    const whatsapp = await whatsappRepository.findWhatsAppAccount(organization.id);
    const twilio = await twilioRepository.findTwilioAccount(organization.id);

    const missing: Array<"GMAIL" | "WHATSAPP" | "TWILIO"> = [];
    if (needed.includes("GMAIL") && !gmailOk) missing.push("GMAIL");
    if (needed.includes("WHATSAPP") && whatsapp?.status !== "ACTIVE") {
      missing.push("WHATSAPP");
    }
    if (needed.includes("TWILIO") && twilio?.status !== "ACTIVE") {
      missing.push("TWILIO");
    }

    if (missing.length > 0) {
      return apiSuccess({
        status: "needs_permissions" as const,
        step: "permissions",
        draft: {
          name: draft.name,
          description: draft.description,
          triggerType: draft.triggerType,
          validation: draft.validation,
          nodeCount: draft.graph.nodes.length,
          sheetSyncMinutes: syncMinutes,
        },
        missingIntegrations: missing,
        reconnectUrl: "/api/v1/integrations/gmail/connect?reconnect=1",
        sheet: null,
        automation: null,
      });
    }

    let sheet: {
      id: string;
      spreadsheetUrl: string | null;
      sheetTitle: string;
      extractionTableId: string;
      extractionTableName: string;
      needsGooglePermissions?: boolean;
      reconnectUrl?: string;
      setupNote?: string;
      autoSyncOn?: boolean;
      syncMinutes?: number;
    } | null = null;

    let graph = draft.graph;
    const requestOrigin = new URL(request.url).origin;
    const needsSheet = graphNeedsSheet(draft.graph);

    if (needsSheet) {
      let tables = await extractionTableRepository.list(organization.id);
      let table = tables[0];
      if (!table) {
        const created = await extractionTableRepository.create({
          organizationId: organization.id,
          name: `${draft.name} data`,
          columns: normalizeColumns([
            { label: "From", hint: "Sender phone or email" },
            { label: "Subject", hint: "Subject or topic" },
            { label: "Summary", hint: "Short summary" },
          ]),
        });
        table = {
          id: created.id,
          name: created.name,
          description: created.description,
          columns: normalizeColumns([
            { label: "From" },
            { label: "Subject" },
            { label: "Summary" },
          ]),
          rowCount: 0,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        };
      }

      const existing = await sheetExportRepository.findByTableId(
        organization.id,
        table.id
      );

      let exportId: string;

      if (existing?.spreadsheetUrl) {
        exportId = existing.id;
        await sheetExportRepository.updateSyncInterval(
          existing.id,
          organization.id,
          syncMinutes
        );

        if (
          resolvedSheetTitle &&
          existing.sheetTitle !== resolvedSheetTitle &&
          existing.spreadsheetId
        ) {
          try {
            const { google } = await import("googleapis");
            const { account } = await getGoogleAuthClientForOrganization(
              organization.id
            );
            const auth = await ensureSheetsOAuthClient(account);
            const sheets = google.sheets({ version: "v4", auth });
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId: existing.spreadsheetId,
              requestBody: {
                requests: [
                  {
                    updateSpreadsheetProperties: {
                      properties: { title: resolvedSheetTitle },
                      fields: "title",
                    },
                  },
                ],
              },
            });
            await sheetExportRepository.update(existing.id, organization.id, {
              sheetTitle: resolvedSheetTitle,
            });
          } catch (renameErr) {
            console.warn("[studio/launch] rename sheet:", renameErr);
          }
        }

        sheet = {
          id: existing.id,
          spreadsheetUrl: existing.spreadsheetUrl,
          sheetTitle: resolvedSheetTitle,
          extractionTableId: table.id,
          extractionTableName: table.name,
          syncMinutes,
        };
      } else {
        if (existing) {
          await sheetExportRepository.delete(existing.id, organization.id);
        }
        if (!hasReachablePublicAppUrl(requestOrigin)) {
          await startDevTunnelIfEnabled();
        }
        const publicUrlHealth = await ensureHealthyPublicAppUrl(requestOrigin);
        const apiBaseUrl = publicUrlHealth.reachable
          ? publicUrlHealth.url
          : requestOrigin;

        const { key, hash, prefix } = generateSheetSyncApiKey();
        const sheetTitle = resolvedSheetTitle;
        const provisioned = await provisionGoogleSheetExport({
          organizationId: organization.id,
          tableId: table.id,
          sheetTitle,
          apiKey: key,
          apiBaseUrl,
          triggerMinutes: syncMinutes,
        });

        const created = await sheetExportRepository.create({
          organizationId: organization.id,
          extractionTableId: table.id,
          label: draft.name,
          sheetTitle,
          spreadsheetId: provisioned.spreadsheetId,
          spreadsheetUrl: provisioned.spreadsheetUrl,
          appsScriptId: provisioned.appsScriptId || undefined,
          syncIntervalMinutes: syncMinutes,
          apiKeyHash: hash,
          apiKeyPrefix: prefix,
        });

        exportId = created.id;
        sheet = {
          id: created.id,
          spreadsheetUrl: created.spreadsheetUrl,
          sheetTitle: created.sheetTitle,
          extractionTableId: table.id,
          extractionTableName: table.name,
          syncMinutes,
          setupNote: provisioned.setupNote,
        };
      }

      // Auto-wire Apps Script timer — user should not open the sheet menu.
      let autoSyncOn = false;
      try {
        const { account } = await getGoogleAuthClientForOrganization(
          organization.id
        );
        const auth = await ensureSheetsOAuthClient(account);
        const installed = await installSheetExportTrigger({
          auth,
          organizationId: organization.id,
          exportId,
          requestOrigin,
          repairOnly: false,
          triggerMinutes: syncMinutes,
        });
        autoSyncOn = installed.triggerInstalled;
        if (sheet) {
          sheet.autoSyncOn = autoSyncOn;
          sheet.setupNote = installed.message;
          if (!autoSyncOn && installed.reason === "authorization") {
            sheet.needsGooglePermissions = true;
            sheet.reconnectUrl = buildGmailReconnectUrl(requestOrigin, {
              popup: true,
              sheetExportId: exportId,
            });
          } else {
            sheet.needsGooglePermissions = false;
          }
        }
      } catch (syncErr) {
        console.warn("[studio/launch] auto-sync wire:", syncErr);
        if (sheet) {
          sheet.needsGooglePermissions = true;
          sheet.reconnectUrl = buildGmailReconnectUrl(requestOrigin, {
            popup: true,
            sheetExportId: exportId,
          });
          sheet.setupNote =
            syncErr instanceof Error
              ? syncErr.message
              : "One Google approval is needed to finish auto-sync.";
        }
      }

      graph = wireSheetIntoGraph(graph, sheet!);

      // Do not await a full Gmail→extract→sheet sync here — it often exceeds
      // serverless/gateway limits (504). Install already pushed rows when possible;
      // keep-alive / sheet timer finishes the rest.
    }

    const triggerType = (
      [
        "NEW_GMAIL_EMAIL",
        "NEW_WHATSAPP_MESSAGE",
        "NEW_SMS",
        "NEW_TWILIO_WHATSAPP",
        "SCHEDULED_TIME",
        "AI_EXTRACTION_COMPLETED",
      ].includes(draft.triggerType)
        ? draft.triggerType
        : "NEW_GMAIL_EMAIL"
    ) as AutomationTriggerType;

    let automation = await automationRepository.create({
      organizationId: organization.id,
      name: draft.name,
      description: draft.description,
      triggerType,
      graph,
    });

    if (parsed.data.activate) {
      automation = await automationRepository.update(automation.id, {
        status: "ACTIVE",
      });
    }

    return apiSuccess({
      status: "ready" as const,
      step: "ready",
      draft: {
        name: draft.name,
        description: draft.description,
        triggerType: draft.triggerType,
        validation: draft.validation,
        nodeCount: graph.nodes.length,
        sheetSyncMinutes: syncMinutes,
      },
      missingIntegrations: [] as string[],
      reconnectUrl: null,
      sheet,
      automation: {
        id: automation.id,
        name: automation.name,
        status: automation.status,
      },
    });
  } catch (err) {
    console.error("[studio/launch]", err);
    return apiError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Could not build your automation",
      500
    );
  }
}
