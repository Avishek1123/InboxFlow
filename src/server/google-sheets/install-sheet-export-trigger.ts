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
import { pushBoundScriptContent } from "@/server/google-sheets/finalize-bound-script";
import { installAppsScriptTimeTrigger } from "@/server/google-sheets/install-apps-script-trigger";
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
        `Starred Gmail → Gemini AI → this sheet (runs in Google — InboxFlow server not required). ` +
        `Open the sheet → InboxFlow → Sync now if empty.`,
    };
  }

  if (setup.reason === "gcp_project") {
    return {
      triggerInstalled: false,
      triggerCount: 0,
      appsScriptId: scriptId,
      spreadsheetUrl,
      scriptEditorUrl,
      reason: "gcp_project",
      errorMessage: setup.errorMessage,
      message: inboxflowGcpLinkStepsMessage(scriptId),
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
      message:
        `Open InboxFlow → Finish Google approval (one popup). No sheet menu needed.` +
        (setup.errorMessage ? ` (${setup.errorMessage})` : ""),
    };
  }

  if (setup.reason === "not_found") {
    return {
      triggerInstalled: false,
      triggerCount: 0,
      appsScriptId: scriptId,
      spreadsheetUrl,
      scriptEditorUrl,
      reason: "sheet_menu",
      message: inboxflowSheetTriggerFallbackMessage(scriptId),
    };
  }

  return {
    triggerInstalled: false,
    triggerCount: 0,
    appsScriptId: scriptId,
    spreadsheetUrl,
    scriptEditorUrl,
    reason: setup.reason,
    message:
      setup.errorMessage ??
      "Could not install the timer. Use Grant Google permissions on this page.",
  };
}
