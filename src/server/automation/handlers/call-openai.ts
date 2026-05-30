import { aiService } from "@/server/ai/service";
import type { AiTaskTypeName } from "@/types/ai";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleCallOpenai(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = params.node.config as Record<string, unknown>;
  const task = (config.task as AiTaskTypeName) ?? "FULL_ANALYSIS";
  const channel =
    params.context.trigger.channel === "WHATSAPP" ? "WHATSAPP" : "GMAIL";

  const body =
    String(params.context.trigger.body ?? "") ||
    JSON.stringify(params.context.trigger);

  const results = await aiService.analyze({
    organizationId: params.organizationId,
    messageId: params.context.trigger.messageId as string | undefined,
    tasks: task,
    message: {
      channel,
      subject: params.context.trigger.subject as string | undefined,
      body,
      fromAddress: params.context.trigger.from as string | undefined,
    },
    replyTone: (config.replyTone as "professional" | "friendly" | "concise") ??
      "professional",
  });

  const result = results[0];
  return {
    output: result,
    variables: { aiResult: result.result, aiProvider: result.provider },
  };
}
