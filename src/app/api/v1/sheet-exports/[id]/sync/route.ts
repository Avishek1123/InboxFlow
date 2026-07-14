import { apiError, apiSuccess } from "@/lib/api-response";
import { isGmailOAuthReconnectMessage } from "@/lib/gmail/google-oauth-errors";
import { GMAIL_RECONNECT_FOR_SHEETS_MESSAGE } from "@/lib/gmail/scopes";
import { syncStarredMailToSheet } from "@/server/google-sheets/sync-starred-mail-to-sheet";
import { ensureSheetKeepAliveWorker } from "@/server/google-sheets/sheet-keepalive";
import { requireOrganization } from "@/server/organizations/require-organization";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

/** Pull starred Gmail → AI extract → write Google Sheet (website path, no Apps Script). */
export async function POST(_request: Request, { params }: Params) {
  try {
    ensureSheetKeepAliveWorker();
    const { organization } = await requireOrganization();
    const { id } = await params;

    const row = await prisma.sheetExport.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!row?.spreadsheetId) {
      return apiError("NOT_FOUND", "Sheet export not found", 404);
    }

    const result = await syncStarredMailToSheet({
      organizationId: organization.id,
      exportId: id,
      starredOnly: true,
    });

    return apiSuccess({
      rowCount: result.rowCount,
      gmailSynced: true,
      messagesFetched: result.messagesFetched,
      extraction: {
        processed: result.extracted,
        succeeded: result.extracted,
        failed: 0,
        rounds: 1,
      },
    });
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
