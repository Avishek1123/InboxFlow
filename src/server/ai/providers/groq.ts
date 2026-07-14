import { getEnv, getGroqApiKeys } from "@/lib/env";
import { AiProviderError } from "../errors";
import type { AiProviderAdapter, CompletionRequest, CompletionResult } from "../types";
import { createOpenAiCompatibleProvider } from "./openai-compatible";

function isRateLimited(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("quota exceeded") ||
    lower.includes("tokens per day") ||
    lower.includes("tpd")
  );
}

/**
 * Groq adapter with multi-key failover: on 429 / daily TPD, try the next key.
 */
export function createGroqProvider(): AiProviderAdapter {
  const env = getEnv();
  const keys = getGroqApiKeys();

  return {
    name: "GROQ",
    isConfigured: () => keys.length > 0,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      if (keys.length === 0) {
        throw new AiProviderError("GROQ", "API key not configured");
      }

      const errors: string[] = [];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]!;
        const provider = createOpenAiCompatibleProvider({
          name: "GROQ",
          apiKey: key,
          model: env.GROQ_MODEL,
          baseUrl: "https://api.groq.com/openai/v1",
        });
        try {
          return await provider.complete(request);
        } catch (err) {
          const msg =
            err instanceof AiProviderError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Unknown";
          errors.push(`key#${i + 1}: ${msg}`);
          if (isRateLimited(msg) && i < keys.length - 1) {
            console.warn(
              `[groq] Key #${i + 1} rate-limited — trying next Groq key`
            );
            continue;
          }
          if (i < keys.length - 1) {
            // Non-rate errors: still try next key once (wrong key / revoked)
            if (
              msg.includes("invalid_api_key") ||
              msg.includes("Incorrect API key")
            ) {
              console.warn(
                `[groq] Key #${i + 1} invalid — trying next Groq key`
              );
              continue;
            }
          }
          throw err instanceof AiProviderError
            ? err
            : new AiProviderError("GROQ", msg);
        }
      }

      throw new AiProviderError(
        "GROQ",
        `All Groq API keys failed: ${errors.join("; ")}`
      );
    },
  };
}
