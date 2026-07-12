import { NextResponse } from "next/server";
import { graphHasTriggerKind } from "@/server/automation/graph";
import { cronMatchesNow } from "@/lib/automation/cron-match";
import { prisma } from "@/server/db";
import { automationDispatcher } from "@/server/automation/dispatcher";
import { automationExecutor } from "@/server/automation/executor";
import { automationExecutionRepository } from "@/server/repositories/automation-execution.repository";
import type { WorkflowGraph } from "@/types/automation";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    scheduled: 0,
    skippedCron: 0,
    retries: 0,
    errors: [] as string[],
  };

  const active = await prisma.automation.findMany({
    where: { status: "ACTIVE" },
  });
  const scheduled = active.filter((a) =>
    graphHasTriggerKind(a.graph, "SCHEDULED_TIME")
  );

  const now = new Date();
  for (const automation of scheduled) {
    try {
      const graph = automation.graph as unknown as WorkflowGraph;
      const trigger = graph.nodes.find((n) => n.data.kind === "SCHEDULED_TIME");
      const expr =
        automation.cronExpression ||
        String(trigger?.data.config?.cronExpression ?? "");
      const tz =
        automation.timezone ||
        String(trigger?.data.config?.timezone ?? "UTC");

      if (!cronMatchesNow(expr, now, tz)) {
        results.skippedCron += 1;
        continue;
      }

      await automationDispatcher.dispatch({
        organizationId: automation.organizationId,
        triggerType: "SCHEDULED_TIME",
        payload: {
          scheduledAt: now.toISOString(),
          automationId: automation.id,
        },
      });
      results.scheduled += 1;
    } catch (e) {
      results.errors.push(
        `schedule:${automation.id}: ${e instanceof Error ? e.message : "error"}`
      );
    }
  }

  const pendingRetries =
    await automationExecutionRepository.findPendingRetries(20);

  for (const execution of pendingRetries) {
    try {
      await automationExecutor.retryExecution(execution.id);
      results.retries += 1;
    } catch (e) {
      results.errors.push(
        `retry:${execution.id}: ${e instanceof Error ? e.message : "error"}`
      );
    }
  }

  return NextResponse.json({
    ok: true,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
