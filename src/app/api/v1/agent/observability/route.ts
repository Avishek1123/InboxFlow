import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { prisma } from "@/server/db";
import { formatUsd } from "@/server/agent/pricing";
import { listTools } from "@/server/agent";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { organization } = await requireOrganization();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      executions,
      agentRuns,
      toolCalls,
      usageRows,
      pendingApprovals,
      failedExecutions,
      waitingApprovals,
    ] = await Promise.all([
      prisma.automationExecution.findMany({
        where: { organizationId: organization.id, startedAt: { gte: since } },
        orderBy: { startedAt: "desc" },
        take: 40,
        include: {
          automation: { select: { id: true, name: true } },
          steps: { orderBy: { startedAt: "asc" } },
        },
      }),
      prisma.agentRun.findMany({
        where: { organizationId: organization.id, startedAt: { gte: since } },
        orderBy: { startedAt: "desc" },
        take: 30,
        include: { toolCalls: { orderBy: { createdAt: "asc" } } },
      }),
      prisma.agentToolCall.findMany({
        where: { agentRun: { organizationId: organization.id } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.aiUsageDaily.findMany({
        where: { organizationId: organization.id },
        orderBy: { day: "desc" },
        take: 14,
      }),
      prisma.approvalRequest.count({
        where: { organizationId: organization.id, status: "PENDING" },
      }),
      prisma.automationExecution.count({
        where: {
          organizationId: organization.id,
          status: { in: ["FAILED", "RETRYING"] },
          startedAt: { gte: since },
        },
      }),
      prisma.automationExecution.count({
        where: {
          organizationId: organization.id,
          status: "WAITING_APPROVAL",
        },
      }),
    ]);

    const totalInput = usageRows.reduce((s, r) => s + r.inputTokens, 0);
    const totalOutput = usageRows.reduce((s, r) => s + r.outputTokens, 0);
    const totalCost = usageRows.reduce((s, r) => s + r.estimatedCostUsd, 0);

    const completed = executions.filter((e) => e.status === "COMPLETED").length;
    const successRate =
      executions.length === 0
        ? 100
        : Math.round((completed / executions.length) * 1000) / 10;

    return apiSuccess({
      summary: {
        executions24h: executions.length,
        agentRuns24h: agentRuns.length,
        toolCallsRecent: toolCalls.length,
        successRate24h: successRate,
        failed24h: failedExecutions,
        pendingApprovals,
        waitingApprovals,
        inputTokens: totalInput,
        outputTokens: totalOutput,
        estimatedCostUsd: totalCost,
        estimatedCostLabel: formatUsd(totalCost),
        toolsAvailable: listTools().length,
      },
      executions,
      agentRuns,
      toolCalls,
      usage: usageRows,
      tools: listTools().map((t) => ({
        name: t.name,
        description: t.description,
        sideEffect: t.sideEffect,
        requiresApproval: Boolean(t.requiresApproval),
      })),
    });
  } catch (err) {
    console.error("[agent/observability]", err);
    return apiError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Failed to load observability",
      500
    );
  }
}
