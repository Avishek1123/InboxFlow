import { apiError, apiSuccess } from "@/lib/api-response";
import { isGmailOAuthReconnectMessage } from "@/lib/gmail/google-oauth-errors";
import { GMAIL_RECONNECT_FOR_SHEETS_MESSAGE } from "@/lib/gmail/scopes";
import { syncSheetExportFull } from "@/server/google-sheets/sync-sheet-export-full";
import { requireOrganization } from "@/server/organizations/require-organization";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

/** Push latest dashboard rows into the linked Google Sheet (no Apps Script needed). */
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

    const result = await syncSheetExportFull({
      organizationId: organization.id,
      exportId: id,
    });

    return apiSuccess(result);
  } catch (err) {
    console.error("[sheet-exports sync]", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    if (isGmailOAuthReconnectMessage(message)) {
      return apiError("GOOGLE_WRONG_PROJECT", message, 403);
    }
    if (
      message.includes("updated permissions") ||
      message.includes("insufficient")
    ) {
      return apiError("GMAIL_SCOPES_REQUIRED", GMAIL_RECONNECT_FOR_SHEETS_MESSAGE, 403);
    }
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
