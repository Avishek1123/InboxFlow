import { getEnv } from "@/lib/env";
import type { AiProviderName } from "@prisma/client";
import { AiProviderError } from "../errors";
import type {
  AiProviderAdapter,
  CompletionRequest,
  CompletionResult,
} from "../types";
import { estimateTokens } from "../utils";

type OpenAiCompatibleConfig = {
  name: AiProviderName;
  apiKey: string | undefined;
  model: string;
  baseUrl: string;
  extraHeaders?: Record<string, string>;
};

export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig
): AiProviderAdapter {
  return {
    name: config.name,
    isConfigured: () => Boolean(config.apiKey?.trim()),
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      if (!config.apiKey) {
        throw new AiProviderError(config.name, "API key not configured");
      }

      const env = getEnv();
      const started = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        env.AI_REQUEST_TIMEOUT_MS
      );

      const body: Record<string, unknown> = {
        model: config.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 2048,
      };

      if (request.jsonMode) {
        body.response_format = { type: "json_object" };
      }

      try {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
            ...config.extraHeaders,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new AiProviderError(
            config.name,
            `HTTP ${res.status}: ${errText.slice(0, 500)}`
          );
        }

        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) {
          throw new AiProviderError(config.name, "Empty response from model");
        }

        const inputText = request.messages.map((m) => m.content).join("");
        return {
          content,
          provider: config.name,
          model: config.model,
          latencyMs: Date.now() - started,
          inputTokens:
            data.usage?.prompt_tokens ?? estimateTokens(inputText),
          outputTokens:
            data.usage?.completion_tokens ?? estimateTokens(content),
        };
      } catch (err) {
        if (err instanceof AiProviderError) throw err;
        const msg =
          err instanceof Error && err.name === "AbortError"
            ? "Request timed out"
            : err instanceof Error
              ? err.message
              : "Unknown error";
        throw new AiProviderError(config.name, msg, err);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
