import { getEnv } from "@/lib/env";
import { createOpenAiCompatibleProvider } from "./openai-compatible";

export function createOpenRouterProvider() {
  const env = getEnv();
  return createOpenAiCompatibleProvider({
    name: "OPENROUTER",
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
    baseUrl: "https://openrouter.ai/api/v1",
    extraHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "InboxFlow AI",
    },
  });
}
