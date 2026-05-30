import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { gmailRepository } from "@/server/repositories/gmail.repository";

export const runtime = "nodejs";

export async function POST() {
  const { organization } = await requireOrganization();
  const account = await gmailRepository.findGmailAccount(organization.id);

  if (!account) {
    return apiError("NOT_FOUND", "No Gmail account connected", 404);
  }

  const { deletedMessages } = await gmailRepository.clearSyncedGmailData(
    organization.id
  );
  return apiSuccess({ deletedMessages });
}
