import { apiError, apiSuccess } from "@/lib/api-response";
import { automationExecutionRepository } from "@/server/repositories/automation-execution.repository";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const limit = Math.min(
    parseInt(new URL(request.url).searchParams.get("limit") ?? "50", 10) || 50,
    100
  );
  const items = await automationExecutionRepository.listByAutomation(id, limit);
  return apiSuccess({ items });
}
