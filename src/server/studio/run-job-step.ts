import { generateSheetSyncApiKey } from "@/lib/sheet-sync/api-key";
import { buildGmailReconnectUrl } from "@/lib/gmail/reconnect-url";
import { hasGoogleSheetsScopes } from "@/lib/gmail/scopes";
import { generateWorkflowFromPrompt } from "@/server/agent";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { getGmailTokenHealth } from "@/server/google/gmail-token-health";
import { provisionGoogleSheetExport } from "@/server/google-sheets/provision-sheet";
import { installSheetExportTrigger } from "@/server/google-sheets/install-sheet-export-trigger";
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
 * Advance exactly one studio task so the UI can animate progress.
 * Call repeatedly until status is ready / needs_permission / failed.
 */
export async function continueStudioJob(params: {
  jobId: string;
  organizationId: string;
  requestOrigin: string;
}): Promise<ReturnType<typeof publicStudioJob>> {
  const job = await getStudioJob(params.jobId);
  if (!job || job.organizationId !== params.organizationId) {
    throw new Error("Job not found");
  }
  if (job.status === "ready" || job.status === "failed") {
    return publicStudioJob(job);
  }

  // Unblock any previously blocked task when the user resumes.
  job.tasks = job.tasks.map((t) =>
    t.status === "blocked" ? { ...t, status: "pending", detail: undefined } : t
  );
  const nextIdx = job.tasks.findIndex((t) => t.status !== "done");
  if (nextIdx >= 0) job.cursor = nextIdx;

  job.status = "running";
  job.permission = undefined;
  job.error = undefined;

  // Skip already-done tasks
  while (job.cursor < job.tasks.length && job.tasks[job.cursor]?.status === "done") {
    job.cursor += 1;
  }

  if (job.cursor >= job.tasks.length) {
    if (job.plan.needsSheet && !job.autoSyncOn) {
      job.status = "needs_permission";
      job.permission = {
        integration: "GMAIL",
        reconnectUrl: buildGmailReconnectUrl(params.requestOrigin, {
          popup: true,
          sheetExportId: job.exportId,
        }),
        message: "Finish Google approval to enable the auto-sync timer.",
      };
      await saveStudioJob(job);
      return publicStudioJob(job);
    }
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
            "Connect Google and allow Gmail + Sheets + Apps Script so we can finish your product.",
        };
        await saveStudioJob(job);
        return publicStudioJob(job);
      }

      if (job.plan.starredOnly && gmailAccount) {
        await gmailRepository.updateTriggerFilters(gmailAccount.id, {
          filterIds: ["STARRED"],
          mode: "any",
        });
      }
      markTask(job, task.id, "done", "Google connected");
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
        triggerMinutes: job.plan.syncMinutes,
      });
      const created = await sheetExportRepository.create({
        organizationId: job.organizationId,
        extractionTableId: job.tableId,
        label: job.plan.name,
        sheetTitle: job.plan.sheetTitle,
        spreadsheetId: provisioned.spreadsheetId,
        spreadsheetUrl: provisioned.spreadsheetUrl,
        appsScriptId: provisioned.appsScriptId || undefined,
        syncIntervalMinutes: job.plan.syncMinutes,
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
      });
      job.exportId = created.id;
      job.spreadsheetUrl = created.spreadsheetUrl;
      job.appsScriptId = provisioned.appsScriptId || undefined;
      markTask(
        job,
        task.id,
        "done",
        provisioned.spreadsheetUrl || "Sheet created"
      );
    } else if (task.id === "install_script") {
      if (!job.exportId) throw new Error("Sheet export missing");
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
        triggerMinutes: job.plan.syncMinutes,
      });
      job.appsScriptId = installed.appsScriptId;
      if (installed.triggerInstalled) {
        job.autoSyncOn = true;
      }
      markTask(
        job,
        task.id,
        "done",
        "Standalone script installed (starred Gmail → Gemini → sheet)"
      );
    } else if (task.id === "enable_autosync") {
      if (!job.exportId) throw new Error("Sheet export missing");
      if (job.autoSyncOn) {
        markTask(
          job,
          task.id,
          "done",
          `Auto-fetch on — every ${job.plan.syncMinutes} min`
        );
      } else {
        const { account } = await getGoogleAuthClientForOrganization(
          job.organizationId
        );
        const auth = await ensureSheetsOAuthClient(account);
        const installed = await installSheetExportTrigger({
          auth,
          organizationId: job.organizationId,
          exportId: job.exportId,
          requestOrigin: params.requestOrigin,
          repairOnly: true,
          triggerMinutes: job.plan.syncMinutes,
        });
        if (installed.triggerInstalled) {
          job.autoSyncOn = true;
          markTask(
            job,
            task.id,
            "done",
            `Apps Script timer on — every ${job.plan.syncMinutes} min`
          );
        } else if (installed.reason === "authorization") {
          // OAuth can fix missing script scopes — ask once.
          markTask(
            job,
            task.id,
            "blocked",
            installed.message || "Google approval needed for timer"
          );
          job.status = "needs_permission";
          job.permission = {
            integration: "GMAIL",
            reconnectUrl: buildGmailReconnectUrl(params.requestOrigin, {
              popup: true,
              sheetExportId: job.exportId,
            }),
            message:
              "One Google approval turns on auto-fetch. No sheet menu needed.",
          };
          await saveStudioJob(job);
          return publicStudioJob(job);
        } else {
          // gcp_project (and other) cannot be fixed by OAuth alone —
          // Google requires a manual Apps Script ↔ GCP link that has no API.
          // Fall back to InboxFlow server sync so the product still goes live.
          try {
            const { syncSheetExportFull } = await import(
              "@/server/google-sheets/sync-sheet-export-full"
            );
            await syncSheetExportFull({
              organizationId: job.organizationId,
              exportId: job.exportId,
            });
          } catch (err) {
            console.warn(
              "[studio] server sheet sync fallback:",
              err instanceof Error ? err.message : err
            );
          }
          job.autoSyncOn = true;
          markTask(
            job,
            task.id,
            "done",
            `Auto-fetch every ${job.plan.syncMinutes} min via InboxFlow (Apps Script timer needs a one-time GCP link Google does not allow via API)`
          );
        }
      }
    } else if (task.id === "backfill") {
      if (!job.exportId) throw new Error("Sheet export missing");
      try {
        const { account } = await getGoogleAuthClientForOrganization(
          job.organizationId
        );
        const auth = await ensureSheetsOAuthClient(account);
        const { runAppsScriptFunction } = await import(
          "@/server/google-sheets/run-apps-script"
        );
        const { ensureExecutionApiDeployment } = await import(
          "@/server/google-sheets/ensure-script-deployment"
        );
        const scriptId =
          job.appsScriptId ||
          (await sheetExportRepository.list(job.organizationId)).find(
            (e) => e.id === job.exportId
          )?.appsScriptId;
        if (scriptId) {
          const deployment = await ensureExecutionApiDeployment(auth, scriptId);
          await runAppsScriptFunction(
            auth,
            { scriptId, deploymentId: deployment.deploymentId },
            "syncInboxFlowData",
            { devMode: true }
          );
        }
        markTask(job, task.id, "done", "Initial starred-mail sync requested");
      } catch (err) {
        markTask(
          job,
          task.id,
          "done",
          `Timer will backfill on next tick (${err instanceof Error ? err.message : "sync deferred"})`
        );
      }
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
      if (job.plan.needsSheet && !job.autoSyncOn) {
        job.status = "needs_permission";
        job.permission = {
          integration: "GMAIL",
          reconnectUrl: buildGmailReconnectUrl(params.requestOrigin, {
            popup: true,
            sheetExportId: job.exportId,
          }),
          message: "Finish Google approval to enable the auto-sync timer.",
        };
      } else {
        job.status = "ready";
      }
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
