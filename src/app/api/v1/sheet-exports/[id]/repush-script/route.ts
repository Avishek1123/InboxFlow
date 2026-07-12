import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { assertHealthyPublicAppUrl, ensureHealthyPublicAppUrl } from "@/server/dev-tunnel/ensure-healthy-public-url";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { resolveSheetSyncApiKey } from "@/server/sheet-sync/resolve-api-key";
import { buildAppsScriptConfig } from "@/server/sheet-sync/build-apps-script-config";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { pushBoundScriptContent } from "@/server/google-sheets/finalize-bound-script";
import { resolveBoundScriptProjectId } from "@/server/google-sheets/install-sheet-export-trigger";
import { pushSheetExportDataFromServer } from "@/server/google-sheets/push-sheet-export-data";
import { requireOrganization } from "@/server/organizations/require-organization";
import { readSheetExportAppsScriptId } from "@/server/repositories/sheet-export-apps-script-id";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const repushSchema = z.object({
  apiBaseUrl: z.string().url().max(500).optional(),
  triggerMinutes: z.number().int().min(1).max(60).optional(),
});

/** Upload latest Apps Script + API key to the sheet, then push data from the server. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { organization } = await requireOrganization();
    const { id } = await params;

    let body: z.infer<typeof repushSchema> = {};
    try {
      body = repushSchema.parse(await request.json());
    } catch {
      /* empty body ok */
    }

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

    const { key, hash, prefix } = await resolveSheetSyncApiKey({
      auth,
      scriptId,
      storedHash: row.apiKeyHash,
    });
    const requestOrigin = new URL(request.url).origin;
    const triggerMinutes =
      body.triggerMinutes ?? getSyncPipelineConfig().sheetTriggerMinutes;

    let apiBaseUrl: string;
    const customUrl = body.apiBaseUrl?.trim().replace(/\/$/, "");
    if (customUrl) {
      apiBaseUrl = customUrl;
    } else {
      const publicUrlHealth = await ensureHealthyPublicAppUrl(requestOrigin);
      assertHealthyPublicAppUrl(publicUrlHealth);
      apiBaseUrl = publicUrlHealth.url;
    }

    const scriptConfig = buildAppsScriptConfig({
      apiBaseUrl,
      apiKey: key,
      tableId: row.extractionTableId,
      sheetTitle: row.sheetTitle,
      triggerMinutes,
    });

    await pushBoundScriptContent({ auth, scriptId, scriptConfig });
    await sheetExportRepository.updateApiKey(
      row.id,
      organization.id,
      hash,
      prefix
    );
    await sheetExportRepository.updateAppsScriptId(
      row.id,
      organization.id,
      scriptId
    );

    const { rowCount } = await pushSheetExportDataFromServer({
      organizationId: organization.id,
      exportId: id,
    });

    return apiSuccess({
      scriptUpdated: true,
      rowCount,
      publicApiUrl: apiBaseUrl,
      message: `Script updated and ${rowCount} rows written to the sheet. In the sheet: InboxFlow → Sync status.`,
    });
  } catch (err) {
    console.error("[sheet-exports repush-script]", err);
    const message = err instanceof Error ? err.message : "Repush failed";
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
