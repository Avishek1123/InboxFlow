import { getConfiguredAiProviders, getEnv } from "@/lib/env";
import { AiConfigError, AiProviderError } from "./errors";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { createOpenRouterProvider } from "./providers/openrouter";
import type { AiProviderAdapter, CompletionRequest, CompletionResult } from "./types";

const providerFactories = {
  groq: createGroqProvider,
  gemini: createGeminiProvider,
  openrouter: createOpenRouterProvider,
} as const;

function getProvider(name: keyof typeof providerFactories): AiProviderAdapter {
  return providerFactories[name]();
}

/**
 * Cost-optimized fallback chain: tries providers in AI_PROVIDER_PRIORITY order.
 * Free-tier friendly default: groq → gemini → openrouter.
 */
export async function completeWithFallback(
  request: CompletionRequest
): Promise<CompletionResult> {
  const priority = getConfiguredAiProviders();
  if (priority.length === 0) {
    throw new AiConfigError(
      "No AI provider configured. Set GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY."
    );
  }

  const maxRetries = getEnv().AI_MAX_RETRIES_PER_PROVIDER;
  const errors: string[] = [];

  for (const name of priority) {
    const provider = getProvider(name);
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await provider.complete(request);
      } catch (err) {
        const msg =
          err instanceof AiProviderError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown";
        errors.push(`[${name}#${attempt}] ${msg}`);
        if (attempt < maxRetries) {
          await sleep(300 * (attempt + 1));
        }
      }
    }
  }

  throw new AiProviderError(
    "ALL",
    `All providers failed: ${errors.join("; ")}`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
