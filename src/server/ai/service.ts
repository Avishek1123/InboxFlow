import type { AiTaskType, MessageChannel } from "@prisma/client";
import { cacheKey, getFromCache, setCache } from "./cache";
import { AiError, AiParseError } from "./errors";
import { buildPrompt } from "./prompts";
import { checkRateLimit } from "./rate-limiter";
import { completeWithFallback } from "./router";
import { taskSchemaMap } from "./schemas";
import { aiExtractionRepository } from "../repositories/ai-extraction.repository";
import { extractJsonFromResponse, hashContent } from "./utils";
import type { MessageInput } from "@/types/ai";
import type { AiAnalyzeResponse, AiTaskTypeName } from "@/types/ai";

function resolveSummarizeTask(channel: MessageChannel): AiTaskType {
  return channel === "GMAIL" ? "SUMMARIZE_EMAIL" : "SUMMARIZE_WHATSAPP";
}

function normalizeTasks(
  tasks: AiTaskTypeName | AiTaskTypeName[],
  channel: MessageChannel
): AiTaskType[] {
  const list = Array.isArray(tasks) ? tasks : [tasks];
  return list.map((t) => {
    if (t === "SUMMARIZE_EMAIL" || t === "SUMMARIZE_WHATSAPP") {
      return resolveSummarizeTask(channel);
    }
    return t as AiTaskType;
  });
}

export class AiService {
  async analyze(params: {
    organizationId: string;
    messageId?: string;
    tasks: AiTaskTypeName | AiTaskTypeName[];
    message: MessageInput;
    forceRefresh?: boolean;
    replyTone?: "professional" | "friendly" | "concise";
  }): Promise<AiAnalyzeResponse[]> {
    checkRateLimit(params.organizationId);

    const taskList = normalizeTasks(params.tasks, params.message.channel);

    const results: AiAnalyzeResponse[] = [];

    for (const task of taskList) {
      const result = await this.runTask({
        organizationId: params.organizationId,
        messageId: params.messageId,
        task,
        message: params.message,
        forceRefresh: params.forceRefresh,
        replyTone: params.replyTone,
      });
      results.push(result);
    }

    return results;
  }

  private async runTask(params: {
    organizationId: string;
    messageId?: string;
    task: AiTaskType;
    message: MessageInput;
    forceRefresh?: boolean;
    replyTone?: "professional" | "friendly" | "concise";
  }): Promise<AiAnalyzeResponse> {
    const contentHash = hashContent([
      params.task,
      params.message.channel,
      params.message.subject ?? "",
      params.message.body,
      params.replyTone ?? "",
    ]);

    const memKey = cacheKey(
      params.organizationId,
      params.task,
      contentHash
    );

    if (!params.forceRefresh) {
      const memCached = getFromCache<AiAnalyzeResponse>(memKey);
      if (memCached) return { ...memCached, cached: true };

      const dbCached = await aiExtractionRepository.findCached({
        organizationId: params.organizationId,
        messageId: params.messageId,
        taskType: params.task,
        contentHash,
      });
      if (dbCached?.result) {
        const response: AiAnalyzeResponse = {
          task: params.task,
          result: dbCached.result,
          provider: dbCached.provider ?? "GROQ",
          model: dbCached.model ?? "cached",
          cached: true,
          latencyMs: dbCached.latencyMs ?? 0,
        };
        setCache(memKey, response);
        return response;
      }
    }

    const pending = await aiExtractionRepository.createPending({
      organizationId: params.organizationId,
      messageId: params.messageId,
      taskType: params.task,
      channel: params.message.channel,
      contentHash,
      inputChars: params.message.body.length,
    });

    try {
      const { system, user } = buildPrompt(params.task, params.message, {
        replyTone: params.replyTone,
      });

      const completion = await completeWithFallback({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        jsonMode: true,
        temperature: 0.15,
        maxTokens: params.task === "FULL_ANALYSIS" ? 4096 : 2048,
      });

      const jsonStr = extractJsonFromResponse(completion.content);
      const schema = taskSchemaMap[params.task];
      const parsed = schema.safeParse(JSON.parse(jsonStr));

      if (!parsed.success) {
        throw new AiParseError(
          `Invalid JSON for ${params.task}: ${parsed.error.message}`
        );
      }

      await aiExtractionRepository.markCompleted(pending.id, {
        provider: completion.provider,
        model: completion.model,
        latencyMs: completion.latencyMs,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        result: parsed.data,
      });

      const response: AiAnalyzeResponse = {
        task: params.task,
        result: parsed.data,
        provider: completion.provider,
        model: completion.model,
        cached: false,
        latencyMs: completion.latencyMs,
      };

      setCache(memKey, response);

      // Fire automations for AI extraction completed (non-blocking)
      void import("@/server/automation/dispatcher")
        .then(({ automationDispatcher }) =>
          automationDispatcher.dispatch({
            organizationId: params.organizationId,
            triggerType: "AI_EXTRACTION_COMPLETED",
            payload: {
              messageId: params.messageId,
              taskType: params.task,
              aiResult: parsed.data,
              channel: params.message.channel,
              body: params.message.body,
            },
          })
        )
        .catch(() => {});

      return response;
    } catch (err) {
      const code = err instanceof AiError ? err.code : "AI_UNKNOWN";
      const message = err instanceof Error ? err.message : "Unknown error";
      await aiExtractionRepository.markFailed(pending.id, code, message);
      throw err;
    }
  }

  /** Run all standard extractions in one optimized batch (FULL_ANALYSIS). */
  async fullAnalysis(params: {
    organizationId: string;
    messageId?: string;
    message: MessageInput;
    forceRefresh?: boolean;
    replyTone?: "professional" | "friendly" | "concise";
  }): Promise<AiAnalyzeResponse> {
    const results = await this.analyze({
      ...params,
      tasks: "FULL_ANALYSIS",
    });
    return results[0];
  }
}

export const aiService = new AiService();
