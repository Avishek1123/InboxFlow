import { apiError, apiSuccess } from "@/lib/api-response";
import { updateAutomationSchema } from "@/lib/validations/automation";
import { validateGraph } from "@/server/automation/graph";
import { requireOrganization } from "@/server/organizations/require-organization";
import { automationRepository } from "@/server/repositories/automation.repository";
import type { WorkflowGraph } from "@/types/automation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const item = await automationRepository.findById(id);
  if (!item) return apiError("NOT_FOUND", "Automation not found", 404);
  return apiSuccess({ item });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateAutomationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
  }

  if (parsed.data.graph) {
    const { valid, errors } = validateGraph(parsed.data.graph as WorkflowGraph);
    if (!valid) {
      return apiError("INVALID_GRAPH", errors.join("; "), 400);
    }
  }

  const item = await automationRepository.update(id, {
    ...parsed.data,
    graph: parsed.data.graph as WorkflowGraph | undefined,
  });
  return apiSuccess({ item });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { organization } = await requireOrganization();
  const { id } = await params;
  const existing = await automationRepository.findById(id);
  if (!existing || existing.organizationId !== organization.id) {
    return apiError("NOT_FOUND", "Automation not found", 404);
  }
  await automationRepository.delete(id);
  return apiSuccess({ deleted: true });
}
