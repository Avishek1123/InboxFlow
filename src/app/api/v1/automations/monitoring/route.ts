import { apiError, apiSuccess } from "@/lib/api-response";
import { automationRepository } from "@/server/repositories/automation.repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const orgId = new URL(request.url).searchParams.get("organizationId");
  if (!orgId) {
    return apiError("VALIDATION_ERROR", "organizationId required", 400);
  }
  const stats = await automationRepository.getMonitoringStats(orgId);
  return apiSuccess({ stats });
}
