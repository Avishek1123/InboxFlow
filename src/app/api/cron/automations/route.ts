import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { automationDispatcher } from "@/server/automation/dispatcher";
import { automationExecutor } from "@/server/automation/executor";
import { automationExecutionRepository } from "@/server/repositories/automation-execution.repository";

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
    retries: 0,
    errors: [] as string[],
  };

  // Scheduled automations
  const scheduled = await prisma.automation.findMany({
    where: { status: "ACTIVE", triggerType: "SCHEDULED_TIME" },
  });

  for (const automation of scheduled) {
    try {
      await automationDispatcher.dispatch({
        organizationId: automation.organizationId,
        triggerType: "SCHEDULED_TIME",
        payload: {
          scheduledAt: new Date().toISOString(),
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

  // Retry failed executions
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
