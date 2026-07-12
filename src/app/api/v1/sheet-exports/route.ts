import { google } from "googleapis";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { hasReachablePublicAppUrl, isLocalAppUrl } from "@/lib/app-url";
import { startDevTunnelIfEnabled } from "@/server/dev-tunnel";
import { ensureHealthyPublicAppUrl } from "@/server/dev-tunnel/ensure-healthy-public-url";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { buildSheetExportSyncNote } from "@/lib/sheet-sync/sync-messaging";
import { isGmailOAuthReconnectMessage } from "@/lib/gmail/google-oauth-errors";
import { GMAIL_RECONNECT_FOR_SHEETS_MESSAGE } from "@/lib/gmail/scopes";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";
import { generateSheetSyncApiKey } from "@/lib/sheet-sync/api-key";
import { provisionGoogleSheetExport } from "@/server/google-sheets/provision-sheet";
import { installAppsScriptTimeTrigger } from "@/server/google-sheets/install-apps-script-trigger";
import { buildGmailReconnectUrl } from "@/lib/gmail/reconnect-url";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { requireOrganization } from "@/server/organizations/require-organization";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";
import type {
  SheetExportCreateResult,
  SheetExportRecord,
} from "@/types/sheet-export";

export const runtime = "nodejs";

function buildSheetExportItem(
  row: SheetExportRecord,
  extra: {
    syncNote?: string;
    triggerInstalled: boolean;
    triggerCount?: number;
    needsGooglePermissions?: boolean;
    reconnectUrl?: string;
  }
): SheetExportCreateResult {
  return {
    ...row,
    syncNote: extra.syncNote,
    triggerInstalled: extra.triggerInstalled,
    triggerCount: extra.triggerCount,
    needsGooglePermissions: extra.needsGooglePermissions,
    reconnectUrl: extra.reconnectUrl,
  };
}

const createSchema = z.object({
  extractionTableId: z.string().min(1),
  label: z.string().max(120).optional(),
  sheetTitle: z.string().min(1).max(120).optional(),
  /** Public HTTPS URL embedded in Apps Script (defaults to dev tunnel / env). */
  apiBaseUrl: z.string().url().max(500).optional(),
  /** Sheet auto-sync interval in minutes (1–60). */
  triggerMinutes: z.number().int().min(1).max(60).optional(),
});

export async function GET() {
  try {
    const { organization } = await requireOrganization();
    const items = await sheetExportRepository.list(organization.id);
    return apiSuccess({ items });
  } catch (err) {
    console.error("[sheet-exports GET]", err);
    const message = err instanceof Error ? err.message : "Failed to load exports";
    if (
      message.includes("sheetExport") ||
      message.includes("sheet_exports") ||
      message.includes("Prisma client is missing")
    ) {
      return apiError(
        "SCHEMA_OUTDATED",
        "Database client is out of date. Stop the dev server, run: npx prisma generate && npx prisma db push, then npm run dev",
        503
      );
    }
    return apiError("INTERNAL_ERROR", message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const { organization } = await requireOrganization();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
    }

    const table = await extractionTableRepository.getById(
      parsed.data.extractionTableId,
      organization.id
    );
    if (!table) {
      return apiError("NOT_FOUND", "Extraction table not found", 404);
    }

    const linked = await sheetExportRepository.findByTableId(
      organization.id,
      table.id
    );
    if (linked?.spreadsheetUrl) {
      return apiSuccess({
        item: buildSheetExportItem(linked, {
          syncNote: "This table already has a Google Sheet — use the link below.",
          triggerInstalled: true,
        }),
      });
    }
    if (linked) {
      await sheetExportRepository.delete(linked.id, organization.id);
    }

    const { key, hash, prefix } = generateSheetSyncApiKey();
    const sheetTitle =
      parsed.data.sheetTitle?.trim() || `${table.name} — InboxFlow`;
    const requestOrigin = new URL(request.url).origin;
    const triggerMinutes =
      parsed.data.triggerMinutes ?? getSyncPipelineConfig().sheetTriggerMinutes;

    let apiBaseUrl: string;
    const customUrl = parsed.data.apiBaseUrl?.trim().replace(/\/$/, "");
    if (customUrl) {
      apiBaseUrl = customUrl;
    } else {
      if (!hasReachablePublicAppUrl(requestOrigin)) {
        await startDevTunnelIfEnabled();
      }
      const publicUrlHealth = await ensureHealthyPublicAppUrl(requestOrigin);
      // Sheet link works without a public tunnel — Apps Script timer is optional.
      apiBaseUrl = publicUrlHealth.reachable
        ? publicUrlHealth.url
        : requestOrigin;
    }

    const {
      spreadsheetId,
      spreadsheetUrl,
      appsScriptId,
      scriptReady: provisionTriggerReady,
      setupNote,
      needsAutoSyncSetup,
    } = await provisionGoogleSheetExport({
      organizationId: organization.id,
      tableId: table.id,
      sheetTitle,
      apiKey: key,
      apiBaseUrl,
      triggerMinutes,
    });

    const { account } = await getGoogleAuthClientForOrganization(organization.id);
    const auth = await ensureSheetsOAuthClient(account);

    async function finishExport(
      exportId: string,
      record: Awaited<ReturnType<typeof sheetExportRepository.create>>
    ) {
      let setup: Awaited<ReturnType<typeof installAppsScriptTimeTrigger>> = {
        installed: provisionTriggerReady,
        triggerCount: provisionTriggerReady ? 1 : 0,
        reason: provisionTriggerReady ? "ok" : undefined,
      };
      if (!provisionTriggerReady && appsScriptId) {
        setup = await installAppsScriptTimeTrigger(auth, appsScriptId, {
          fresh: false,
        });
      }
      const triggerReady = setup.installed;
      const needsGooglePermissions =
        Boolean(needsAutoSyncSetup || !triggerReady) &&
        !isLocalAppUrl(apiBaseUrl);

      const syncNote =
        setupNote ??
        buildSheetExportSyncNote({
          apiBaseUrl,
          scriptTriggerReady: triggerReady,
          setupNote,
          triggerMinutes,
        });

      return apiSuccess({
        item: buildSheetExportItem(record, {
          syncNote,
          triggerInstalled: triggerReady,
          triggerCount: setup.triggerCount,
          needsGooglePermissions,
          reconnectUrl: needsGooglePermissions
            ? buildGmailReconnectUrl(requestOrigin, {
                popup: true,
                sheetExportId: exportId,
              })
            : undefined,
        }),
      });
    }

    try {
      const created = await sheetExportRepository.create({
        organizationId: organization.id,
        extractionTableId: table.id,
        label: parsed.data.label,
        sheetTitle,
        spreadsheetId,
        spreadsheetUrl,
        appsScriptId,
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
      });
      return finishExport(created.id, created);
    } catch (dbErr) {
      if (!isPrismaUniqueViolation(dbErr)) throw dbErr;

      const existingExport = await sheetExportRepository.findByTableId(
        organization.id,
        table.id
      );
      if (!existingExport) throw dbErr;

      if (!existingExport.spreadsheetUrl) {
        const updated = await sheetExportRepository.updateAfterProvision(
          existingExport.id,
          organization.id,
          {
            spreadsheetId,
            spreadsheetUrl,
            sheetTitle,
            appsScriptId,
            apiKeyHash: hash,
            apiKeyPrefix: prefix,
            label: parsed.data.label,
          }
        );
        return finishExport(updated.id, updated);
      }

      try {
        const { account } = await getGoogleAuthClientForOrganization(
          organization.id
        );
        const auth = await ensureSheetsOAuthClient(account);
        const drive = google.drive({ version: "v3", auth });
        await drive.files.delete({ fileId: spreadsheetId });
      } catch {
        /* duplicate Google Sheet removed if possible */
      }

      return apiSuccess({
        item: buildSheetExportItem(existingExport, {
          syncNote: "This table already has a Google Sheet — use the link below.",
          triggerInstalled: true,
        }),
      });
    }
  } catch (err) {
    console.error("[sheet-exports POST]", err);
    const message = err instanceof Error ? err.message : "Failed to create sheet";
    if (message.includes("cannot call localhost") || message.includes("NEXT_PUBLIC_APP_URL")) {
      return apiError("PUBLIC_URL_REQUIRED", message, 400);
    }
    if (message.includes("Connect Gmail")) {
      return apiError("GMAIL_REQUIRED", message, 400);
    }
    if (isGmailOAuthReconnectMessage(message)) {
      return apiError("GOOGLE_WRONG_PROJECT", message, 403);
    }
    if (
      message.includes("not enabled on the InboxFlow") ||
      message.includes("not InboxFlow") ||
      message.includes("GOOGLE_CLIENT_ID is tied")
    ) {
      return apiError("GOOGLE_WRONG_PROJECT", message, 403);
    }
    if (message.includes("not enabled on the same Cloud project")) {
      return apiError("GOOGLE_API_DISABLED", message, 403);
    }
    if (
      message.includes("script.google.com/home/usersettings") ||
      message.includes("has not enabled the Apps Script API")
    ) {
      return apiError("APPS_SCRIPT_USER_SETTING", message, 403);
    }
    if (
      message.includes("updated permissions") ||
      message.includes("insufficient") ||
      message.includes("insufficient authentication scopes") ||
      message === GMAIL_RECONNECT_FOR_SHEETS_MESSAGE
    ) {
      return apiError("GMAIL_SCOPES_REQUIRED", message, 403);
    }
    if (isPrismaUniqueViolation(err)) {
      return apiError(
        "CONFLICT",
        "This table already has a Google Sheet. Refresh the page — it is listed under Your Google Sheets.",
        409
      );
    }
    if (message.toLowerCase().includes("not found")) {
      return apiError(
        "APPS_SCRIPT_NOT_READY",
        "Google Apps Script is still initializing. Wait 30 seconds and try again.",
        503
      );
    }
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
