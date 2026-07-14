import { generateSheetSyncApiKey } from "@/lib/sheet-sync/api-key";
import { buildGmailReconnectUrl } from "@/lib/gmail/reconnect-url";
import { hasGoogleSheetsScopes } from "@/lib/gmail/scopes";
import { generateWorkflowFromPrompt } from "@/server/agent";
import { getGmailTokenHealth } from "@/server/google/gmail-token-health";
import { collectStarredMailToTable } from "@/server/google-sheets/collect-starred-mail-to-table";
import { installSheetExportTrigger } from "@/server/google-sheets/install-sheet-export-trigger";
import { provisionGoogleSheetExport } from "@/server/google-sheets/provision-sheet";
import { pushSheetExportDataFromServer } from "@/server/google-sheets/push-sheet-export-data";
import { syncStarredMailToSheet } from "@/server/google-sheets/sync-starred-mail-to-sheet";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { automationRepository } from "@/server/repositories/automation.repository";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";
import {
  getStudioJob,
  publicStudioJob,
  saveStudioJob,
  type StudioJob,
} from "@/server/studio/job-store";
import type { AutomationTriggerType } from "@prisma/client";
import type { WorkflowGraph } from "@/types/automation";

function markTask(
  job: StudioJob,
  id: string,
  status: "running" | "done" | "blocked" | "failed",
  detail?: string
) {
  job.tasks = job.tasks.map((t) =>
    t.id === id ? { ...t, status, detail: detail ?? t.detail } : t
  );
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

async function ensureWorkflowGraph(job: StudioJob): Promise<WorkflowGraph> {
  if (job.graph) return job.graph;
  const draft = await generateWorkflowFromPrompt({
    organizationId: job.organizationId,
    prompt: job.prompt,
  });
  let graph = draft.graph;
  if (job.plan.starredOnly) {
    graph = wireStarredOnlyIntoGraph(graph);
  }
  job.graph = graph;
  return graph;
}

/**
 * Advance exactly one studio task.
 * Flow: access → collect data → create sheet → wait for user autosync click → activate.
 */
export async function continueStudioJob(params: {
  jobId: string;
  organizationId: string;
  requestOrigin: string;
  /** User clicked "Enable auto-sync" in the UI. */
  enableAutosync?: boolean;
}): Promise<ReturnType<typeof publicStudioJob>> {
  const job = await getStudioJob(params.jobId);
  if (!job || job.organizationId !== params.organizationId) {
    throw new Error("Job not found");
  }
  if (job.status === "ready" || job.status === "failed") {
    return publicStudioJob(job);
  }

  if (params.enableAutosync) {
    job.autosyncConfirmed = true;
  }

  // Unblock previously blocked tasks when the user resumes.
  job.tasks = job.tasks.map((t) =>
    t.status === "blocked" ? { ...t, status: "pending", detail: undefined } : t
  );
  const nextIdx = job.tasks.findIndex((t) => t.status !== "done");
  if (nextIdx >= 0) job.cursor = nextIdx;

  job.status = "running";
  job.permission = undefined;
  job.error = undefined;

  while (job.cursor < job.tasks.length && job.tasks[job.cursor]?.status === "done") {
    job.cursor += 1;
  }

  if (job.cursor >= job.tasks.length) {
    job.status = "ready";
    await saveStudioJob(job);
    return publicStudioJob(job);
  }

  const task = job.tasks[job.cursor]!;
  markTask(job, task.id, "running");
  await saveStudioJob(job);

  try {
    if (task.id === "permissions") {
      const gmailAccount = await gmailRepository.findGmailAccount(
        job.organizationId
      );
      const health = await getGmailTokenHealth(gmailAccount);
      const ok =
        Boolean(gmailAccount?.status === "ACTIVE") &&
        !health.needsReconnect &&
        hasGoogleSheetsScopes(gmailAccount?.scopes);

      if (!ok) {
        markTask(
          job,
          task.id,
          "blocked",
          "Google Sheets + Gmail access required"
        );
        job.status = "needs_permission";
        job.permission = {
          integration: "GMAIL",
          reconnectUrl: buildGmailReconnectUrl(params.requestOrigin, {
            popup: true,
          }),
          message:
            "Connect Google with full access (Gmail + Sheets) so we can collect your data and create the sheet.",
        };
        await saveStudioJob(job);
        return publicStudioJob(job);
      }

      if (job.plan.starredOnly && gmailAccount) {
        await gmailRepository.updateTriggerFilters(gmailAccount.id, {
          filterIds: ["STARRED"],
          mode: "any",
        });
        await gmailRepository.updateSyncState(gmailAccount.id, {
          gmailHistoryId: null,
        });
      }
      markTask(job, task.id, "done", "Google connected — full access ready");
    } else if (task.id === "create_table") {
      const created = await extractionTableRepository.create({
        organizationId: job.organizationId,
        name: `${job.plan.sheetTitle} data`,
        columns: job.plan.columns,
      });
      job.tableId = created.id;
      job.tableName = created.name;
      markTask(
        job,
        task.id,
        "done",
        `Headings: ${job.plan.columns.map((c) => c.label).join(", ")}`
      );
    } else if (task.id === "collect_data") {
      if (!job.tableId) throw new Error("Table missing before data collect");
      const collected = await collectStarredMailToTable({
        organizationId: job.organizationId,
        tableId: job.tableId,
        starredOnly: job.plan.starredOnly,
      });
      markTask(
        job,
        task.id,
        "done",
        collected.extracted > 0
          ? `Collected ${collected.extracted} rows from ${collected.messagesFetched} starred emails`
          : collected.messagesFetched > 0
            ? `Fetched ${collected.messagesFetched} starred emails — extraction wrote 0 rows (check AI keys / rate limits)`
            : "No starred Gmail found yet — you can star emails and sync later"
      );
    } else if (task.id === "create_sheet") {
      if (!job.tableId || !job.tableName) {
        throw new Error("Table missing before sheet create");
      }
      const { key, hash, prefix } = generateSheetSyncApiKey();
      const provisioned = await provisionGoogleSheetExport({
        organizationId: job.organizationId,
        tableId: job.tableId,
        sheetTitle: job.plan.sheetTitle,
        apiKey: key,
        apiBaseUrl: params.requestOrigin,
        triggerMinutes: 1,
        // Bound Apps Script now; 1‑min timer arms on website Enable auto-sync.
        websiteAutosyncOnly: false,
      });
      const created = await sheetExportRepository.create({
        organizationId: job.organizationId,
        extractionTableId: job.tableId,
        label: job.plan.name,
        sheetTitle: job.plan.sheetTitle,
        spreadsheetId: provisioned.spreadsheetId,
        spreadsheetUrl: provisioned.spreadsheetUrl,
        appsScriptId: provisioned.appsScriptId || undefined,
        syncIntervalMinutes: 1,
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
      });
      job.exportId = created.id;
      job.spreadsheetUrl = created.spreadsheetUrl;
      job.appsScriptId = provisioned.appsScriptId || undefined;

      // Push already-collected rows into the new sheet
      let rowCount = 0;
      try {
        const pushed = await pushSheetExportDataFromServer({
          organizationId: job.organizationId,
          exportId: created.id,
          skipPrepare: true,
        });
        rowCount = pushed.rowCount;
      } catch (err) {
        console.warn(
          "[studio] initial sheet push:",
          err instanceof Error ? err.message : err
        );
      }

      markTask(
        job,
        task.id,
        "done",
        rowCount > 0
          ? `${provisioned.spreadsheetUrl || "Sheet created"} · ${rowCount} rows written`
          : provisioned.spreadsheetUrl || "Sheet created"
      );
    } else if (task.id === "enable_autosync") {
      if (!job.exportId) throw new Error("Sheet export missing");

      // Wait for an explicit user click on the website.
      if (!job.autosyncConfirmed) {
        markTask(
          job,
          task.id,
          "blocked",
          "Activate live sync on this website — Google approval only"
        );
        job.status = "awaiting_autosync";
        await saveStudioJob(job);
        return publicStudioJob(job);
      }

      // Require Google OAuth with Gmail + Sheets (website popup — never sheet menu).
      const gmailAccount = await gmailRepository.findGmailAccount(
        job.organizationId
      );
      const health = await getGmailTokenHealth(gmailAccount);
      const googleOk =
        Boolean(gmailAccount?.status === "ACTIVE") &&
        !health.needsReconnect &&
        hasGoogleSheetsScopes(gmailAccount?.scopes);

      if (!googleOk) {
        markTask(
          job,
          task.id,
          "blocked",
          "Approve Google access in the popup, then click Enable auto-sync again"
        );
        job.status = "needs_permission";
        job.autosyncConfirmed = false;
        job.permission = {
          integration: "GMAIL",
          reconnectUrl: buildGmailReconnectUrl(params.requestOrigin, {
            popup: true,
            sheetExportId: job.exportId,
          }),
          message:
            "Allow Gmail + Google Sheets in the popup. Auto-sync runs from InboxFlow — you do not open the sheet.",
        };
        await saveStudioJob(job);
        return publicStudioJob(job);
      }

      // Install container-bound Apps Script + 1‑min time trigger (Google cloud).
      const { account } = await getGoogleAuthClientForOrganization(
        job.organizationId
      );
      const auth = await ensureSheetsOAuthClient(account);
      const installed = await installSheetExportTrigger({
        auth,
        organizationId: job.organizationId,
        exportId: job.exportId,
        requestOrigin: params.requestOrigin,
        repairOnly: false,
        triggerMinutes: 1,
      });
      job.appsScriptId = installed.appsScriptId;
      job.plan.syncMinutes = 1;

      if (!installed.triggerInstalled) {
        markTask(
          job,
          task.id,
          "blocked",
          "Finish Google approval on this website to arm the 1‑minute Apps Script timer"
        );
        job.status = "needs_permission";
        job.autosyncConfirmed = false;
        job.permission = {
          integration: "GMAIL",
          reconnectUrl: buildGmailReconnectUrl(params.requestOrigin, {
            popup: true,
            sheetExportId: job.exportId,
          }),
          message:
            installed.message ||
            "Approve Google once here — Apps Script will sync your sheet every minute. Nothing to click in the sheet.",
          webAppUrl: installed.webAppUrl ?? null,
          sheetExportId: job.exportId,
          reason: installed.reason,
        };
        await saveStudioJob(job);
        return publicStudioJob(job);
      }

      await sheetExportRepository.updateSyncInterval(
        job.exportId,
        job.organizationId,
        1
      );

      // Seed sheet immediately; timer keeps it fresh in Google.
      let rowCount = 0;
      try {
        const synced = await syncStarredMailToSheet({
          organizationId: job.organizationId,
          exportId: job.exportId,
          starredOnly: job.plan.starredOnly,
        });
        rowCount = synced.rowCount;
      } catch (err) {
        console.warn(
          "[studio] seed sync after Apps Script:",
          err instanceof Error ? err.message : err
        );
      }

      job.autoSyncOn = true;
      job.permission = undefined;
      markTask(
        job,
        task.id,
        "done",
        rowCount > 0
          ? `Apps Script live — every 1 min · ${rowCount} rows`
          : "Apps Script live — every 1 min (runs in Google, no sheet menu)"
      );
    } else if (task.id === "activate") {
      const graph = await ensureWorkflowGraph(job);
      const wired =
        job.exportId && job.tableId && job.tableName
          ? wireSheetIntoGraph(graph, {
              id: job.exportId,
              extractionTableId: job.tableId,
              extractionTableName: job.tableName,
            })
          : graph;

      const triggerType = (
        [
          "NEW_GMAIL_EMAIL",
          "NEW_WHATSAPP_MESSAGE",
          "NEW_SMS",
          "NEW_TWILIO_WHATSAPP",
          "SCHEDULED_TIME",
          "AI_EXTRACTION_COMPLETED",
        ].includes(job.plan.triggerType)
          ? job.plan.triggerType
          : "NEW_GMAIL_EMAIL"
      ) as AutomationTriggerType;

      let automation = await automationRepository.create({
        organizationId: job.organizationId,
        name: job.plan.name,
        description: job.plan.description,
        triggerType,
        graph: wired,
      });
      automation = await automationRepository.update(automation.id, {
        status: "ACTIVE",
      });
      job.automationId = automation.id;
      job.automationName = automation.name;
      job.automationStatus = automation.status;
      job.graph = wired;
      markTask(job, task.id, "done", "Product active");
    } else if (task.id === "plan") {
      markTask(job, task.id, "done");
    }

    job.cursor += 1;

    if (job.cursor >= job.tasks.length) {
      job.status = "ready";
    } else {
      job.status = "running";
    }

    await saveStudioJob(job);
    return publicStudioJob(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Step failed";
    markTask(job, task.id, "failed", message);
    job.status = "failed";
    job.error = message;
    await saveStudioJob(job);
    return publicStudioJob(job);
  }
}
