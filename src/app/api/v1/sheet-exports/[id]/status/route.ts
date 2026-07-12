import { apiError, apiSuccess } from "@/lib/api-response";
import { getPublicAppBaseUrl, hasReachablePublicAppUrl } from "@/lib/app-url";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { readAppsScriptTriggerCount } from "@/server/google-sheets/install-apps-script-trigger";
import { readSheetExportAppsScriptId } from "@/server/repositories/sheet-export-apps-script-id";
import { requireOrganization } from "@/server/organizations/require-organization";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { organization } = await requireOrganization();
    const { id } = await params;
    const requestOrigin = new URL(request.url).origin;

    const row = await prisma.sheetExport.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!row?.spreadsheetId) {
      return apiError("NOT_FOUND", "Sheet export not found", 404);
    }

    const scriptId =
      row.appsScriptId ?? (await readSheetExportAppsScriptId(row.id));
    const publicApiUrl = getPublicAppBaseUrl(requestOrigin);
    const apiReachable = hasReachablePublicAppUrl(requestOrigin);
    const { sheetTriggerMinutes } = getSyncPipelineConfig();

    let triggerCount = 0;
    let triggerCheckError: string | undefined;
    if (scriptId) {
      try {
        const { account } = await getGoogleAuthClientForOrganization(
          organization.id
        );
        const auth = await ensureSheetsOAuthClient(account);
        const check = await readAppsScriptTriggerCount(auth, scriptId);
        triggerCount = check.count;
        if (check.error) triggerCheckError = check.error;
      } catch (err) {
        triggerCheckError =
          err instanceof Error ? err.message : "Could not check trigger";
      }
    }

    return apiSuccess({
      lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null,
      publicApiUrl,
      apiReachable,
      apiKeyPrefix: row.apiKeyPrefix,
      triggerCount,
      autoSyncOn: triggerCount > 0,
      triggerCheckError,
      sheetTriggerMinutes,
      usesLocaltunnel: publicApiUrl.includes("loca.lt"),
    });
  } catch (err) {
    console.error("[sheet-exports status]", err);
    const message = err instanceof Error ? err.message : "Status check failed";
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
