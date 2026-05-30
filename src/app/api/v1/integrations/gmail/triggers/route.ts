import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { gmailRepository } from "@/server/repositories/gmail.repository";

export const runtime = "nodejs";

const bodySchema = z.object({
  filterIds: z
    .array(
      z.enum([
        "INBOX",
        "STARRED",
        "IMPORTANT",
        "UNREAD",
        "SENT",
        "PERSONAL",
        "PROMOTIONS",
        "SOCIAL",
        "UPDATES",
      ])
    )
    .min(1),
  mode: z.enum(["any", "all"]).default("any"),
});

export async function PATCH(request: Request) {
  const { organization } = await requireOrganization();
  const account = await gmailRepository.findGmailAccount(organization.id);

  if (!account || account.status !== "ACTIVE") {
    return apiError("NOT_FOUND", "Connect Gmail first", 404);
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid trigger settings", 400, parsed.error.flatten());
  }

  const updated = await gmailRepository.updateTriggerFilters(
    account.id,
    parsed.data
  );

  return apiSuccess({
    triggerFilters: gmailRepository.toSummary(updated).triggerFilters,
  });
}
