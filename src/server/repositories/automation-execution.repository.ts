import type {
  AutomationExecutionStatus,
  AutomationStepStatus,
  AutomationTriggerType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db";
import type { ExecutionContext } from "@/types/automation";

export const automationExecutionRepository = {
  async findById(id: string) {
    return prisma.automationExecution.findUnique({
      where: { id },
      include: { steps: { orderBy: { startedAt: "asc" } } },
    });
  },

  async listByAutomation(automationId: string, limit = 50) {
    return prisma.automationExecution.findMany({
      where: { automationId },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { steps: { orderBy: { startedAt: "asc" } } },
    });
  },

  async create(data: {
    organizationId: string;
    automationId: string;
    triggerType: AutomationTriggerType;
    triggerPayload: Prisma.InputJsonValue;
  }) {
    return prisma.automationExecution.create({
      data: {
        organizationId: data.organizationId,
        automationId: data.automationId,
        triggerType: data.triggerType,
        triggerPayload: data.triggerPayload,
        status: "PENDING",
      },
    });
  },

  async markRunning(id: string) {
    return prisma.automationExecution.update({
      where: { id },
      data: { status: "RUNNING" },
    });
  },

  async markCompleted(id: string, context: ExecutionContext) {
    return prisma.automationExecution.update({
      where: { id },
      data: {
        status: "COMPLETED",
        context: context as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  },

  async markFailed(id: string, errorMessage: string) {
    return prisma.automationExecution.update({
      where: { id },
      data: {
        status: "FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });
  },

  async markWaitingApproval(id: string, context: ExecutionContext, note: string) {
    return prisma.automationExecution.update({
      where: { id },
      data: {
        status: "WAITING_APPROVAL",
        context: context as unknown as Prisma.InputJsonValue,
        errorMessage: note,
      },
    });
  },

  async scheduleRetry(
    id: string,
    retryCount: number,
    nextRetryAt: Date,
    errorMessage: string
  ) {
    return prisma.automationExecution.update({
      where: { id },
      data: {
        status: "RETRYING",
        retryCount,
        nextRetryAt,
        errorMessage,
      },
    });
  },

  async findPendingRetries(limit = 20) {
    return prisma.automationExecution.findMany({
      where: {
        status: "RETRYING",
        nextRetryAt: { lte: new Date() },
      },
      take: limit,
      orderBy: { nextRetryAt: "asc" },
    });
  },

  async createStep(data: {
    executionId: string;
    nodeId: string;
    nodeType: string;
    label?: string;
  }) {
    return prisma.automationExecutionStep.create({
      data: {
        executionId: data.executionId,
        nodeId: data.nodeId,
        nodeType: data.nodeType,
        label: data.label,
        status: "PENDING",
      },
    });
  },

  async updateStep(
    id: string,
    data: Partial<{
      status: AutomationStepStatus;
      input: Prisma.InputJsonValue;
      output: Prisma.InputJsonValue;
      errorMessage: string;
      latencyMs: number;
    }>
  ) {
    return prisma.automationExecutionStep.update({
      where: { id },
      data: {
        ...data,
        completedAt:
          data.status === "COMPLETED" || data.status === "FAILED"
            ? new Date()
            : undefined,
      },
    });
  },
};
