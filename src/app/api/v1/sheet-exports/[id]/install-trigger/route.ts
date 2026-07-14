import { apiError, apiSuccess } from "@/lib/api-response";
import { isGmailOAuthReconnectMessage } from "@/lib/gmail/google-oauth-errors";
import { GMAIL_RECONNECT_FOR_SHEETS_MESSAGE } from "@/lib/gmail/scopes";
import { getGoogleAuthClientForOrganization } from "@/server/google/auth-client";
import { ensureSheetsOAuthClient } from "@/server/google/ensure-sheets-auth";
import { installSheetExportTrigger } from "@/server/google-sheets/install-sheet-export-trigger";
import { requireOrganization } from "@/server/organizations/require-organization";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Push latest script + install (or repair) the 15-minute time trigger on the linked sheet. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { organization } = await requireOrganization();
    const { id } = await params;
    let repairOnly = true;
    let triggerMinutes: number | undefined;
    try {
      const body = (await request.json()) as {
        repairOnly?: boolean;
        triggerMinutes?: number;
      };
      if (body.repairOnly === false) repairOnly = false;
      if (
        typeof body.triggerMinutes === "number" &&
        Number.isFinite(body.triggerMinutes)
      ) {
        triggerMinutes = Math.max(1, Math.min(60, body.triggerMinutes));
      }
    } catch {
      /* empty body → repair-only poll */
    }

    const { account } = await getGoogleAuthClientForOrganization(organization.id);
    const auth = await ensureSheetsOAuthClient(account);

    const result = await installSheetExportTrigger({
      auth,
      organizationId: organization.id,
      exportId: id,
      requestOrigin: new URL(request.url).origin,
      repairOnly,
      triggerMinutes,
    });

    return apiSuccess(result);
  } catch (err) {
    console.error("[sheet-exports install-trigger]", err);
    const message =
      err instanceof Error ? err.message : "Failed to install trigger";
    if (isGmailOAuthReconnectMessage(message)) {
      return apiError("GOOGLE_WRONG_PROJECT", message, 403);
    }
    if (
      message.includes("updated permissions") ||
      message.includes("insufficient") ||
      message === GMAIL_RECONNECT_FOR_SHEETS_MESSAGE
    ) {
      return apiError("GMAIL_SCOPES_REQUIRED", message, 403);
    }
    if (message.includes("script.google.com/home/usersettings")) {
      return apiError("APPS_SCRIPT_USER_SETTING", message, 403);
    }
    if (message.includes("Sheet export not found")) {
      return apiError("NOT_FOUND", message, 404);
    }
    if (message.toLowerCase().includes("not found")) {
      return apiError(
        "APPS_SCRIPT_NOT_READY",
        "Google Apps Script is still initializing. Wait 30 seconds, open the sheet → InboxFlow → Enable auto-sync, or try Install auto-sync trigger again.",
        503
      );
    }
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
