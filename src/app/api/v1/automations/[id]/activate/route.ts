import { apiError, apiSuccess } from "@/lib/api-response";
import { validateGraph } from "@/server/automation/graph";
import { automationRepository } from "@/server/repositories/automation.repository";
import type { WorkflowGraph } from "@/types/automation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const automation = await automationRepository.findById(id);
  if (!automation) return apiError("NOT_FOUND", "Automation not found", 404);

  const { valid, errors } = validateGraph(
    automation.graph as unknown as WorkflowGraph
  );
  if (!valid) {
    return apiError("INVALID_GRAPH", errors.join("; "), 400);
  }

  const item = await automationRepository.update(id, { status: "ACTIVE" });
  return apiSuccess({ item });
}
