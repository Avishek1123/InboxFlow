import { google } from "googleapis";
import { formatGoogleApiDisabledError } from "@/lib/gmail/google-api-errors";
import { assertInboxflowOAuthClientConfigured } from "@/lib/gmail/inboxflow-gcp";
import {
  GMAIL_RECONNECT_FOR_SHEETS_MESSAGE,
  hasGoogleSheetsScopes,
} from "@/lib/gmail/scopes";
import { DEFAULT_SHEET_SYNC_GMAIL_FILTER } from "@/lib/sheet-sync/gmail-filter";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { finalizeBoundScriptProject } from "@/server/google-sheets/finalize-bound-script";
import { buildSheetSyncPayload } from "@/server/sheet-sync/build-export-payload";
import { buildStandaloneAppsScriptConfig } from "@/server/sheet-sync/standalone-script-config";
import { writePayloadToSpreadsheet } from "@/server/google-sheets/write-sheet-data";

function isInsufficientScopesError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("insufficient") ||
    msg.includes("Insufficient Permission") ||
    msg.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")
  );
}

/**
 * Creates a Google Spreadsheet, seeds rows, and installs a standalone Apps Script:
 * starred Gmail → Gemini AI → sheet (runs in Google's cloud every N minutes).
 * InboxFlow server is not called by the timer.
 */
export async function provisionGoogleSheetExport(params: {
  organizationId: string;
  tableId: string;
  sheetTitle: string;
  apiKey: string;
  apiBaseUrl: string;
  triggerMinutes?: number;
}): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  appsScriptId: string;
  scriptReady: boolean;
  setupNote?: string;
  needsAutoSyncSetup?: boolean;
}> {
  assertInboxflowOAuthClientConfigured();

  const { account } = await getGoogleAuthClientForOrganization(
    params.organizationId
  );

  if (!hasGoogleSheetsScopes(account.scopes)) {
    throw new Error(GMAIL_RECONNECT_FOR_SHEETS_MESSAGE);
  }

  const auth = await ensureSheetsOAuthClient(account);
  const sheets = google.sheets({ version: "v4", auth });

  let created;
  try {
    created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: params.sheetTitle },
      },
    });
  } catch (err) {
    const disabled = formatGoogleApiDisabledError(err);
    if (disabled) throw new Error(disabled);
    if (isInsufficientScopesError(err)) {
      throw new Error(GMAIL_RECONNECT_FOR_SHEETS_MESSAGE);
    }
    throw err;
  }

  const spreadsheetId = created.data.spreadsheetId;
  const spreadsheetUrl = created.data.spreadsheetUrl;
  if (!spreadsheetId || !spreadsheetUrl) {
    throw new Error("Google did not return a spreadsheet id");
  }

  const payload = await buildSheetSyncPayload(
    params.tableId,
    params.organizationId,
    { gmailFilter: DEFAULT_SHEET_SYNC_GMAIL_FILTER }
  );
  if (payload) {
    await writePayloadToSpreadsheet(
      sheets,
      spreadsheetId,
      params.sheetTitle,
      payload
    );
  }

  const triggerMinutes =
    params.triggerMinutes ?? getSyncPipelineConfig().sheetTriggerMinutes;

  try {
    const scriptConfig = await buildStandaloneAppsScriptConfig({
      organizationId: params.organizationId,
      tableId: params.tableId,
      sheetTitle: params.sheetTitle,
      triggerMinutes,
    });

    const finalized = await finalizeBoundScriptProject({
      auth,
      spreadsheetId,
      scriptConfig,
    });

    return {
      spreadsheetId,
      spreadsheetUrl,
      appsScriptId: finalized.scriptId,
      scriptReady: finalized.triggerInstalled,
      needsAutoSyncSetup: !finalized.triggerInstalled,
      setupNote:
        finalized.setupNote ??
        (finalized.triggerInstalled
          ? `Apps Script timer is on (every ${triggerMinutes} min): starred Gmail → Gemini → this sheet. InboxFlow server is not used for the timer.`
          : `Sheet is ready. Open the sheet → InboxFlow → Enable auto-sync so Google can authorize Gmail + Gemini (every ${triggerMinutes} min).`),
    };
  } catch (scriptErr) {
    const note =
      scriptErr instanceof Error
        ? `Sheet is ready. Open the sheet → InboxFlow → Enable auto-sync (${scriptErr.message}).`
        : "Sheet is ready. Open the sheet → InboxFlow → Enable auto-sync.";
    console.warn("[provisionGoogleSheetExport] Apps Script skipped:", scriptErr);
    return {
      spreadsheetId,
      spreadsheetUrl,
      appsScriptId: "",
      scriptReady: false,
      needsAutoSyncSetup: true,
      setupNote: note,
    };
  }
}
