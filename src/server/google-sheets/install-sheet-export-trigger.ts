import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import {
  inboxflowGcpLinkStepsMessage,
  inboxflowSheetTriggerFallbackMessage,
} from "@/lib/gmail/inboxflow-gcp";
import {
  appsScriptUserSettingsMessage,
  isAppsScriptUserSettingsError,
} from "@/lib/gmail/google-api-errors";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { ensureWebAppDeployment } from "@/server/google-sheets/ensure-script-deployment";
import { pushBoundScriptContent } from "@/server/google-sheets/finalize-bound-script";
import { installAppsScriptTimeTrigger } from "@/server/google-sheets/install-apps-script-trigger";
import { readInboxFlowTriggerMeta } from "@/server/google-sheets/read-inboxflow-trigger-meta";
import { boundScriptHasInboxFlowCode } from "@/server/google-sheets/verify-bound-script";
import { buildStandaloneAppsScriptConfig } from "@/server/sheet-sync/standalone-script-config";
import { prisma } from "@/server/db";
import { readSheetExportAppsScriptId } from "@/server/repositories/sheet-export-apps-script-id";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";

export type InstallSheetTriggerResult = {
  triggerInstalled: boolean;
  triggerCount: number;
  appsScriptId: string;
  spreadsheetUrl: string | null;
  scriptEditorUrl: string;
  message: string;
  reason?: string;
  /** Raw Apps Script API error (for debugging). */
  errorMessage?: string;
  /**
   * Open in a popup from InboxFlow — user authorizes once; installs the
   * 1-min Apps Script timer (works when scripts.run / GCP link fails).
   */
  webAppUrl?: string | null;
};

/** Resolve container-bound script id (stored, or create if the sheet has no project yet). */
export async function resolveBoundScriptProjectId(
  auth: OAuth2Client,
  spreadsheetId: string,
  storedScriptId?: string | null
): Promise<string> {
  if (storedScriptId) return storedScriptId;

  const scriptApi = google.script({ version: "v1", auth });
  try {
    const project = await scriptApi.projects.create({
      requestBody: {
        title: "InboxFlow Sync",
        parentId: spreadsheetId,
      },
    });
    const id = project.data.scriptId;
    if (!id) throw new Error("Google did not return an Apps Script project id");
    return id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("already exists") ||
      msg.includes("already has") ||
      msg.includes("PROJECT_EXISTS")
    ) {
      throw new Error(
        "This spreadsheet already has an Apps Script project, but InboxFlow does not have its Script ID saved. Open the sheet → InboxFlow → Enable auto-sync, or remove this export and create a new Google Sheet."
      );
    }
    throw err;
  }
}

export async function installSheetExportTrigger(params: {
  auth: OAuth2Client;
  organizationId: string;
  exportId: string;
  requestOrigin: string;
  /** When true, only run trigger install (no new API key / script upload). Use for polling. */
  repairOnly?: boolean;
  /** Override Apps Script timer interval (1–60 minutes). */
  triggerMinutes?: number;
}): Promise<InstallSheetTriggerResult> {
  const row = await prisma.sheetExport.findFirst({
    where: { id: params.exportId, organizationId: params.organizationId },
  });
  if (!row?.spreadsheetId) {
    throw new Error("Sheet export not found");
  }

  const storedScriptId =
    row.appsScriptId ?? (await readSheetExportAppsScriptId(row.id));
  const scriptId = await resolveBoundScriptProjectId(
    params.auth,
    row.spreadsheetId,
    storedScriptId
  );

  const { sheetTriggerMinutes: defaultMinutes } = getSyncPipelineConfig();
  const sheetTriggerMinutes = Math.max(
    1,
    Math.min(60, params.triggerMinutes ?? defaultMinutes)
  );
  const repairOnly = params.repairOnly ?? false;
  const hasCode = await boundScriptHasInboxFlowCode(params.auth, scriptId);
  const mustPushScript = !repairOnly || !hasCode;

  if (mustPushScript) {
    const scriptConfig = await buildStandaloneAppsScriptConfig({
      organizationId: params.organizationId,
      tableId: row.extractionTableId,
      sheetTitle: row.sheetTitle,
      triggerMinutes: sheetTriggerMinutes,
    });

    try {
      await pushBoundScriptContent({
        auth: params.auth,
        scriptId,
        scriptConfig,
      });
    } catch (err) {
      if (isAppsScriptUserSettingsError(err)) {
        throw new Error(appsScriptUserSettingsMessage());
      }
      throw err;
    }
  } else {
    await new Promise((r) => setTimeout(r, 2000));
  }

  await sheetExportRepository.updateAppsScriptId(
    row.id,
    params.organizationId,
    scriptId
  );

  const setup = await installAppsScriptTimeTrigger(params.auth, scriptId, {
    fresh: !repairOnly,
    warmup: repairOnly,
    forceRedeploy: mustPushScript,
  });
  const scriptEditorUrl = `https://script.google.com/home/projects/${scriptId}/edit`;
  const spreadsheetUrl = row.spreadsheetUrl;

  if (setup.installed) {
    return {
      triggerInstalled: true,
      triggerCount: setup.triggerCount,
      appsScriptId: scriptId,
      spreadsheetUrl,
      scriptEditorUrl,
      reason: "ok",
      message:
        `Auto-sync is on (${setup.triggerCount} timer, every ${sheetTriggerMinutes} min). ` +
        `Starred Gmail → Groq AI → this sheet (runs in Google Apps Script).`,
    };
  }

  // User may have installed the timer via the web-app popup; meta tab confirms it.
  const meta = await readInboxFlowTriggerMeta(params.auth, row.spreadsheetId);
  if (meta.triggerCount > 0) {
    return {
      triggerInstalled: true,
      triggerCount: meta.triggerCount,
      appsScriptId: scriptId,
      spreadsheetUrl,
      scriptEditorUrl,
      reason: "ok",
      message:
        `Auto-sync is on (${meta.triggerCount} timer, every ${sheetTriggerMinutes} min). ` +
        `Starred Gmail → Groq AI → this sheet (runs in Google Apps Script).`,
    };
  }

  // When scripts.run cannot create the timer, deploy a web app the user
  // opens once from InboxFlow (authorizes + installs the time trigger).
  let webAppUrl: string | null = null;
  try {
    const web = await ensureWebAppDeployment(params.auth, scriptId, {
      forceNewVersion: mustPushScript,
    });
    webAppUrl = web.url;
  } catch (err) {
    console.warn(
      "[installSheetExportTrigger] web app:",
      err instanceof Error ? err.message : err
    );
  }

  const webHint = webAppUrl
    ? " Finish Google approval in the InboxFlow popup — that turns on the Apps Script 1‑minute timer."
    : "";

  if (setup.reason === "gcp_project") {
    return {
      triggerInstalled: false,
      triggerCount: 0,
      appsScriptId: scriptId,
      spreadsheetUrl,
      scriptEditorUrl,
      reason: "gcp_project",
      errorMessage: setup.errorMessage,
      webAppUrl,
      message: webAppUrl
        ? `Apps Script is ready.${webHint}`
        : inboxflowGcpLinkStepsMessage(scriptId),
    };
  }

  if (setup.reason === "authorization") {
    return {
      triggerInstalled: false,
      triggerCount: 0,
      appsScriptId: scriptId,
      spreadsheetUrl,
      scriptEditorUrl,
      reason: "authorization",
      errorMessage: setup.errorMessage,
      webAppUrl,
      message: `Google needs one more approval to start the sheet timer.${webHint}`,
    };
  }

  if (setup.reason === "not_found") {
    return {
      triggerInstalled: false,
      triggerCount: 0,
      appsScriptId: scriptId,
      spreadsheetUrl,
      scriptEditorUrl,
      reason: webAppUrl ? "web_app_auth" : "sheet_menu",
      webAppUrl,
      message: webAppUrl
        ? `Apps Script project created.${webHint}`
        : inboxflowSheetTriggerFallbackMessage(scriptId),
    };
  }

  return {
    triggerInstalled: false,
    triggerCount: 0,
    appsScriptId: scriptId,
    spreadsheetUrl,
    scriptEditorUrl,
    reason: webAppUrl ? "web_app_auth" : setup.reason,
    webAppUrl,
    message:
      (setup.errorMessage ??
        "Could not install the timer from the API.") + webHint,
  };
}
