import { apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { inboxRepository } from "@/server/repositories/inbox.repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { organization } = await requireOrganization();
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel") as "GMAIL" | "WHATSAPP" | null;

  const data = await inboxRepository.listMessages(organization.id, {
    channel: channel ?? undefined,
    limit: 100,
  });

  return apiSuccess(data);
}
