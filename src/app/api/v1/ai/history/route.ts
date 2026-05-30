import { apiError, apiSuccess } from "@/lib/api-response";
import { aiExtractionRepository } from "@/server/repositories/ai-extraction.repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return apiError("VALIDATION_ERROR", "organizationId is required", 400);
  }

  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "50", 10) || 50,
    100
  );

  const items = await aiExtractionRepository.listByOrganization(
    organizationId,
    limit
  );

  return apiSuccess({ items });
}
