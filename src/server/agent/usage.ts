import { prisma } from "@/server/db";
import { estimateCostUsd } from "./pricing";

export async function recordAiUsage(params: {
  organizationId: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  const inputTokens = params.inputTokens ?? 0;
  const outputTokens = params.outputTokens ?? 0;
  const estimatedCostUsd = estimateCostUsd({
    model: params.model,
    inputTokens,
    outputTokens,
  });

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  await prisma.aiUsageDaily.upsert({
    where: {
      organizationId_day_provider_model: {
        organizationId: params.organizationId,
        day,
        provider: params.provider,
        model: params.model,
      },
    },
    create: {
      organizationId: params.organizationId,
      day,
      provider: params.provider,
      model: params.model,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      requestCount: 1,
    },
    update: {
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
      estimatedCostUsd: { increment: estimatedCostUsd },
      requestCount: { increment: 1 },
    },
  });

  return { estimatedCostUsd };
}
