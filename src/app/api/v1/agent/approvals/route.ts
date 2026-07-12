import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { prisma } from "@/server/db";
import { automationExecutor } from "@/server/automation/executor";
import { automationRepository } from "@/server/repositories/automation.repository";
import type { AutomationTriggerPayload } from "@/types/automation";

export const runtime = "nodejs";

export async function GET() {
  const { organization } = await requireOrganization();
  const items = await prisma.approvalRequest.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return apiSuccess({ items });
}

const decideSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(1000).optional(),
  resume: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const { organization } = await requireOrganization();
    const parsed = decideSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
    }

    const approval = await prisma.approvalRequest.findFirst({
      where: { id: parsed.data.id, organizationId: organization.id },
    });
    if (!approval) return apiError("NOT_FOUND", "Approval not found", 404);
    if (approval.status !== "PENDING") {
      return apiError("CONFLICT", "Approval already decided", 409);
    }

    const updated = await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: {
        status: parsed.data.decision,
        decidedAt: new Date(),
        decidedNote: parsed.data.note,
      },
    });

    let resumedExecutionId: string | null = null;
    if (
      parsed.data.decision === "APPROVED" &&
      parsed.data.resume !== false &&
      approval.executionId
    ) {
      const execution = await prisma.automationExecution.findFirst({
        where: {
          id: approval.executionId,
          organizationId: organization.id,
        },
      });
      if (execution) {
        const automation = await automationRepository.findById(
          execution.automationId
        );
        if (automation) {
          resumedExecutionId = await automationExecutor.run({
            automation,
            triggerPayload: {
              ...(execution.triggerPayload as AutomationTriggerPayload),
              approvalId: approval.id,
              approvalDecision: "APPROVED",
            },
            // Fresh run after approval — do not reuse waiting execution id
          });
          await prisma.automationExecution.update({
            where: { id: execution.id },
            data: {
              status: "COMPLETED",
              errorMessage: "Approved — continued in a new execution",
              completedAt: new Date(),
            },
          });
        }
      }
    }

    if (parsed.data.decision === "REJECTED" && approval.executionId) {
      await prisma.automationExecution.updateMany({
        where: {
          id: approval.executionId,
          organizationId: organization.id,
          status: "WAITING_APPROVAL",
        },
        data: {
          status: "CANCELLED",
          errorMessage: parsed.data.note || "Rejected by reviewer",
          completedAt: new Date(),
        },
      });
    }

    return apiSuccess({ approval: updated, resumedExecutionId });
  } catch (err) {
    console.error("[agent/approvals]", err);
    return apiError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Approval failed",
      500
    );
  }
}
