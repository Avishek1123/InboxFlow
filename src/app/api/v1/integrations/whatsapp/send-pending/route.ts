import { apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { processWhatsAppOutboundJobs } from "@/server/whatsapp/outbound";

export const runtime = "nodejs";

/** Process queued outbound WhatsApp messages for this org */
export async function POST() {
  const { organization } = await requireOrganization();
  const results = await processWhatsAppOutboundJobs(organization.id);
  return apiSuccess({ results });
}
