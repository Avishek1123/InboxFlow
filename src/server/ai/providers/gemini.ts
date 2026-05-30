import { getEnv } from "@/lib/env";
import { AiProviderError } from "../errors";
import type {
  AiProviderAdapter,
  CompletionRequest,
  CompletionResult,
} from "../types";
import { estimateTokens } from "../utils";

export function createGeminiProvider(): AiProviderAdapter {
  return {
    name: "GEMINI",
    isConfigured: () => Boolean(getEnv().GEMINI_API_KEY?.trim()),
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const env = getEnv();
      if (!env.GEMINI_API_KEY) {
        throw new AiProviderError("GEMINI", "API key not configured");
      }

      const started = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        env.AI_REQUEST_TIMEOUT_MS
      );

      const systemMsg = request.messages.find((m) => m.role === "system");
      const userMsgs = request.messages.filter((m) => m.role !== "system");

      const contents = userMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 2048,
          ...(request.jsonMode
            ? { responseMimeType: "application/json" }
            : {}),
        },
      };

      if (systemMsg) {
        body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new AiProviderError(
            "GEMINI",
            `HTTP ${res.status}: ${errText.slice(0, 500)}`
          );
        }

        const data = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
          };
        };

        const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!content) {
          throw new AiProviderError("GEMINI", "Empty response from model");
        }

        const inputText = request.messages.map((m) => m.content).join("");

        return {
          content,
          provider: "GEMINI",
          model: env.GEMINI_MODEL,
          latencyMs: Date.now() - started,
          inputTokens:
            data.usageMetadata?.promptTokenCount ??
            estimateTokens(inputText),
          outputTokens:
            data.usageMetadata?.candidatesTokenCount ??
            estimateTokens(content),
        };
      } catch (err) {
        if (err instanceof AiProviderError) throw err;
        const msg =
          err instanceof Error && err.name === "AbortError"
            ? "Request timed out"
            : err instanceof Error
              ? err.message
              : "Unknown error";
        throw new AiProviderError("GEMINI", msg, err);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
