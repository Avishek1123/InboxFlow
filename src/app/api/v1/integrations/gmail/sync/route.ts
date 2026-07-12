import { apiError, apiSuccess } from "@/lib/api-response";
import { formatGmailSyncError } from "@/lib/gmail/google-api-errors";
import { requireOrganization } from "@/server/organizations/require-organization";
import { syncGmailAccount } from "@/server/gmail/sync";
import { gmailRepository } from "@/server/repositories/gmail.repository";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  const { organization } = await requireOrganization();
  const account = await gmailRepository.findGmailAccount(organization.id);

  if (!account || account.status !== "ACTIVE") {
    return apiError("NOT_FOUND", "Connect Gmail first", 404);
  }

  try {
    const result = await syncGmailAccount(account);
    return apiSuccess(result);
  } catch (err) {
    const friendly = formatGmailSyncError(err);
    return apiError(
      "SYNC_FAILED",
      friendly ?? (err instanceof Error ? err.message : "Sync failed"),
      500
    );
  }
}
