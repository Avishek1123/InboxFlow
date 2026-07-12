import { google } from "googleapis";
import { isLocalAppUrl } from "@/lib/app-url";
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
import { buildAppsScriptConfig } from "@/server/sheet-sync/build-apps-script-config";
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
 * Creates a Google Spreadsheet and writes table data via Sheets API.
 * Never embeds localhost into Apps Script (Google cannot resolve it → DNS errors).
 * Apps Script auto-sync is best-effort — never roll back a working sheet URL.
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
  /** True when the sheet exists but auto-sync still needs InboxFlow enable + Google consent. */
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

  const { sheetSyncVia, sheetTriggerMinutes } = getSyncPipelineConfig();
  const triggerMinutes = params.triggerMinutes ?? sheetTriggerMinutes;

  // Default path: InboxFlow server pushes via Sheets API (Gmail → AI → sheet).
  // No Apps Script / public webhook URL required.
  if (sheetSyncVia === "server") {
    return {
      spreadsheetId,
      spreadsheetUrl,
      appsScriptId: "",
      scriptReady: true,
      needsAutoSyncSetup: false,
      setupNote: `Sheet updates from InboxFlow every ${triggerMinutes} min while the app is running (Gmail sync → AI extract → Sheets API). No Apps Script needed.`,
    };
  }

  // Legacy path: Google Apps Script polls InboxFlow (needs a public HTTPS URL).
  if (isLocalAppUrl(params.apiBaseUrl)) {
    return {
      spreadsheetId,
      spreadsheetUrl,
      appsScriptId: "",
      scriptReady: false,
      needsAutoSyncSetup: true,
      setupNote:
        "Sheet is ready with your data. Click Enable auto-sync in InboxFlow to install the timer with a public URL (start npm run dev with NGROK_AUTHTOKEN, or deploy). Syncing from the sheet menu will not work until then.",
    };
  }

  try {
    const finalized = await finalizeBoundScriptProject({
      auth,
      spreadsheetId,
      scriptConfig: buildAppsScriptConfig({
        apiBaseUrl: params.apiBaseUrl,
        apiKey: params.apiKey,
        tableId: params.tableId,
        sheetTitle: params.sheetTitle,
        triggerMinutes,
      }),
    });

    return {
      spreadsheetId,
      spreadsheetUrl,
      appsScriptId: finalized.scriptId,
      scriptReady: finalized.triggerInstalled,
      needsAutoSyncSetup: !finalized.triggerInstalled,
      setupNote: finalized.setupNote,
    };
  } catch (scriptErr) {
    const note =
      scriptErr instanceof Error
        ? `Sheet is ready. Click Enable auto-sync in InboxFlow to finish the timer (${scriptErr.message}).`
        : "Sheet is ready. Click Enable auto-sync in InboxFlow to finish the timer.";
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
