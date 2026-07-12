import { apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

export async function GET() {
  const { organization } = await requireOrganization();

  const scheduled = await prisma.automation.findMany({
    where: {
      organizationId: organization.id,
      triggerType: "SCHEDULED_TIME",
    },
    orderBy: { updatedAt: "desc" },
  });

  const outbound = await prisma.whatsAppOutboundJob.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const waiting = await prisma.automationExecution.findMany({
    where: {
      organizationId: organization.id,
      status: { in: ["WAITING_APPROVAL", "RETRYING", "PENDING"] },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { automation: { select: { name: true } } },
  });

  return apiSuccess({
    scheduled: scheduled.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      cronExpression: a.cronExpression,
      timezone: a.timezone,
      lastRunAt: a.lastRunAt,
      runCount: a.runCount,
      lastError: a.lastError,
    })),
    outboundJobs: outbound,
    pendingExecutions: waiting,
  });
}
