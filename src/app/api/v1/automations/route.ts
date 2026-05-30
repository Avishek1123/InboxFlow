import { apiError, apiSuccess } from "@/lib/api-response";
import { createAutomationSchema } from "@/lib/validations/automation";
import { validateGraph } from "@/server/automation/graph";
import { automationRepository } from "@/server/repositories/automation.repository";
import type { WorkflowGraph } from "@/types/automation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const orgId = new URL(request.url).searchParams.get("organizationId");
  if (!orgId) {
    return apiError("VALIDATION_ERROR", "organizationId required", 400);
  }
  const items = await automationRepository.listByOrganization(orgId);
  return apiSuccess({ items });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createAutomationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
    }

    const { valid, errors } = validateGraph(parsed.data.graph as WorkflowGraph);
    if (!valid) {
      return apiError("INVALID_GRAPH", errors.join("; "), 400);
    }

    const item = await automationRepository.create({
      ...parsed.data,
      graph: parsed.data.graph as WorkflowGraph,
    });
    return apiSuccess({ item }, 201);
  } catch (err) {
    console.error("[automations POST]", err);
    return apiError("INTERNAL_ERROR", "Failed to create automation", 500);
  }
}
