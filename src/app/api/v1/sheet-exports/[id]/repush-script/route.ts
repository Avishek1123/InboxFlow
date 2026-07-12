import { z } from "zod";
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

const repushSchema = z.object({
  triggerMinutes: z.number().int().min(1).max(60).optional(),
});

/** Upload standalone Apps Script (Gmail → Gemini → sheet). No InboxFlow API URL needed. */
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

    const triggerMinutes =
      body.triggerMinutes ?? getSyncPipelineConfig().sheetTriggerMinutes;

    const scriptConfig = await buildStandaloneAppsScriptConfig({
      organizationId: organization.id,
      tableId: row.extractionTableId,
      sheetTitle: row.sheetTitle,
      triggerMinutes,
    });

    await pushBoundScriptContent({ auth, scriptId, scriptConfig });
    await sheetExportRepository.updateAppsScriptId(
      row.id,
      organization.id,
      scriptId
    );

    return apiSuccess({
      scriptUpdated: true,
      rowCount: 0,
      message:
        `Standalone script updated (starred Gmail → Gemini → sheet, every ${triggerMinutes} min). ` +
        `In the sheet: InboxFlow → Enable auto-sync, then Sync now.`,
    });
  } catch (err) {
    console.error("[sheet-exports repush-script]", err);
    const message = err instanceof Error ? err.message : "Repush failed";
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
