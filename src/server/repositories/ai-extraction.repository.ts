import type {
  AiExtractionStatus,
  AiProviderName,
  AiTaskType,
  MessageChannel,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db";

export const aiExtractionRepository = {
  async findCached(params: {
    organizationId: string;
    messageId?: string;
    taskType: AiTaskType;
    contentHash: string;
  }) {
    return prisma.aiExtraction.findFirst({
      where: {
        organizationId: params.organizationId,
        messageId: params.messageId ?? null,
        taskType: params.taskType,
        contentHash: params.contentHash,
        status: { in: ["COMPLETED", "CACHED"] },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async createPending(data: {
    organizationId: string;
    messageId?: string;
    taskType: AiTaskType;
    channel?: MessageChannel;
    contentHash: string;
    inputChars: number;
  }) {
    return prisma.aiExtraction.create({
      data: {
        organizationId: data.organizationId,
        messageId: data.messageId,
        taskType: data.taskType,
        channel: data.channel,
        contentHash: data.contentHash,
        inputChars: data.inputChars,
        status: "PENDING",
      },
    });
  },

  async markCompleted(
    id: string,
    data: {
      provider: AiProviderName;
      model: string;
      latencyMs: number;
      inputTokens?: number;
      outputTokens?: number;
      result: Prisma.InputJsonValue;
      cached?: boolean;
    }
  ) {
    return prisma.aiExtraction.update({
      where: { id },
      data: {
        status: data.cached ? "CACHED" : "COMPLETED",
        provider: data.provider,
        model: data.model,
        latencyMs: data.latencyMs,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        result: data.result,
      },
    });
  },

  async markFailed(id: string, errorCode: string, errorMessage: string) {
    return prisma.aiExtraction.update({
      where: { id },
      data: {
        status: "FAILED" as AiExtractionStatus,
        errorCode,
        errorMessage,
      },
    });
  },

  async listByOrganization(organizationId: string, limit = 50) {
    return prisma.aiExtraction.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        message: {
          select: {
            id: true,
            subject: true,
            fromAddress: true,
            channel: true,
          },
        },
      },
    });
  },
};
