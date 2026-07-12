import { apiError, apiSuccess } from "@/lib/api-response";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { buildAppsScriptConfig } from "@/server/sheet-sync/build-apps-script-config";
import { ensureHealthyPublicAppUrl } from "@/server/dev-tunnel/ensure-healthy-public-url";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { pushBoundScriptContent } from "@/server/google-sheets/finalize-bound-script";
import { resolveBoundScriptProjectId } from "@/server/google-sheets/install-sheet-export-trigger";
import { requireOrganization } from "@/server/organizations/require-organization";
import { readSheetExportAppsScriptId } from "@/server/repositories/sheet-export-apps-script-id";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";
import { resolveSheetSyncApiKey } from "@/server/sheet-sync/resolve-api-key";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Rotates API key and pushes it into the bound Apps Script project. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { organization } = await requireOrganization();
    const { id } = await params;

    const row = await prisma.sheetExport.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!row?.spreadsheetId) {
      return apiError("NOT_FOUND", "Export not found", 404);
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

    const requestOrigin = new URL(request.url).origin;
    const publicUrlHealth = await ensureHealthyPublicAppUrl(requestOrigin);
    const { key, hash, prefix } = await resolveSheetSyncApiKey({
      auth,
      scriptId,
      storedHash: row.apiKeyHash,
      rotate: true,
    });
    const { sheetTriggerMinutes } = getSyncPipelineConfig();

    const scriptConfig = buildAppsScriptConfig({
      apiBaseUrl: publicUrlHealth.url,
      apiKey: key,
      tableId: row.extractionTableId,
      sheetTitle: row.sheetTitle,
      triggerMinutes: sheetTriggerMinutes,
    });

    await pushBoundScriptContent({ auth, scriptId, scriptConfig });
    await sheetExportRepository.updateApiKey(id, organization.id, hash, prefix);

    return apiSuccess({
      apiKeyPrefix: prefix,
      message:
        "API key rotated and script updated. Use InboxFlow → Sync now in the sheet to test.",
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
