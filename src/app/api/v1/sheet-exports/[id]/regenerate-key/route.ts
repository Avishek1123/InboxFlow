import { apiError, apiSuccess } from "@/lib/api-response";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { pushBoundScriptContent } from "@/server/google-sheets/finalize-bound-script";
import { resolveBoundScriptProjectId } from "@/server/google-sheets/install-sheet-export-trigger";
import { requireOrganization } from "@/server/organizations/require-organization";
import { readSheetExportAppsScriptId } from "@/server/repositories/sheet-export-apps-script-id";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";
import { buildStandaloneAppsScriptConfig } from "@/server/sheet-sync/standalone-script-config";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Re-push standalone Apps Script with current columns + Gemini key. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { organization } = await requireOrganization();
    const { id } = await params;

    const row = await prisma.sheetExport.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!row?.spreadsheetId) {
      return apiError("NOT_FOUND", "Sheet export not found", 404);
    }

    const { account } = await getGoogleAuthClientForOrganization(organization.id);
    const auth = await ensureSheetsOAuthClient(account);
    const storedScriptId =
      row.appsScriptId ?? (await readSheetExportAppsScriptId(row.id));
    const scriptId = await resolveBoundScriptProjectId(
      auth,
      row.spreadsheetId,
      storedScriptId
    );
    const { sheetTriggerMinutes } = getSyncPipelineConfig();

    const scriptConfig = await buildStandaloneAppsScriptConfig({
      organizationId: organization.id,
      tableId: row.extractionTableId,
      sheetTitle: row.sheetTitle,
      triggerMinutes: sheetTriggerMinutes,
    });

    await pushBoundScriptContent({ auth, scriptId, scriptConfig });
    await sheetExportRepository.updateAppsScriptId(
      id,
      organization.id,
      scriptId
    );

    return apiSuccess({
      apiKeyPrefix: row.apiKeyPrefix,
      message:
        "Standalone script updated (Gmail → Gemini → sheet). Use InboxFlow → Sync now in the sheet to test.",
    });
  } catch (err) {
    console.error("[sheet-exports regenerate-key]", err);
    return apiError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Failed",
      500
    );
  }
}
