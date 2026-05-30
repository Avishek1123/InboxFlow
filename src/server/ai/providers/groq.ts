import { getEnv } from "@/lib/env";
import { createOpenAiCompatibleProvider } from "./openai-compatible";

export function createGroqProvider() {
  const env = getEnv();
  return createOpenAiCompatibleProvider({
    name: "GROQ",
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_MODEL,
    baseUrl: "https://api.groq.com/openai/v1",
  });
}
