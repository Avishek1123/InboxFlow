import type {
  AutomationStatus,
  AutomationTriggerType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db";
import type { WorkflowGraph } from "@/types/automation";

export const automationRepository = {
  async findById(id: string) {
    return prisma.automation.findUnique({ where: { id } });
  },

  async listByOrganization(organizationId: string) {
    return prisma.automation.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findActiveByTrigger(
    organizationId: string,
    triggerType: AutomationTriggerType
  ) {
    return prisma.automation.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        triggerType,
      },
    });
  },

  async findActiveForOrganization(organizationId: string) {
    return prisma.automation.findMany({
      where: { organizationId, status: "ACTIVE" },
    });
  },

  async create(data: {
    organizationId: string;
    name: string;
    description?: string;
    triggerType: AutomationTriggerType;
    graph: WorkflowGraph;
    cronExpression?: string;
    timezone?: string;
  }) {
    return prisma.automation.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        graph: data.graph as unknown as Prisma.InputJsonValue,
        cronExpression: data.cronExpression,
        timezone: data.timezone,
        status: "DRAFT",
      },
    });
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      status: AutomationStatus;
      graph: WorkflowGraph;
      triggerType: AutomationTriggerType;
      cronExpression: string;
      timezone: string;
      version: number;
    }>
  ) {
    return prisma.automation.update({
      where: { id },
      data: {
        ...data,
        graph: data.graph
          ? (data.graph as unknown as Prisma.InputJsonValue)
          : undefined,
        version: data.graph ? { increment: 1 } : undefined,
      },
    });
  },

  async delete(id: string) {
    return prisma.automation.delete({ where: { id } });
  },

  async incrementRunCount(id: string, success: boolean, error?: string) {
    return prisma.automation.update({
      where: { id },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date(),
        lastError: success ? null : error,
      },
    });
  },

  async getMonitoringStats(organizationId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, active, executions, completed, failedRetry] =
      await Promise.all([
        prisma.automation.count({ where: { organizationId } }),
        prisma.automation.count({
          where: { organizationId, status: "ACTIVE" },
        }),
        prisma.automationExecution.count({
          where: { organizationId, startedAt: { gte: since } },
        }),
        prisma.automationExecution.count({
          where: {
            organizationId,
            startedAt: { gte: since },
            status: "COMPLETED",
          },
        }),
        prisma.automationExecution.count({
          where: {
            organizationId,
            status: { in: ["FAILED", "RETRYING"] },
            nextRetryAt: { not: null },
          },
        }),
      ]);

    return {
      totalAutomations: total,
      activeAutomations: active,
      executions24h: executions,
      successRate24h: executions > 0 ? completed / executions : 1,
      failedPendingRetry: failedRetry,
    };
  },
};
