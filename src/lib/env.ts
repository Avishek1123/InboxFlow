import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().optional(),

  // AI providers (at least one required for AI features)
  GROQ_API_KEY: z.string().optional(),
  /** Fallback Groq key when the primary hits 429 / daily limits */
  GROQ_API_KEY_2: z.string().optional(),
  /** Optional comma-separated Groq keys (tried in order after KEY / KEY_2) */
  GROQ_API_KEYS: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash-lite"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z
    .string()
    .default("meta-llama/llama-3.2-3b-instruct:free"),

  /** Comma-separated provider priority: groq,gemini,openrouter */
  AI_PROVIDER_PRIORITY: z.string().default("groq,gemini,openrouter"),
  AI_MAX_INPUT_CHARS: z.coerce.number().default(12_000),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().default(30_000),
  AI_RATE_LIMIT_PER_ORG_PER_MINUTE: z.coerce.number().default(30),
  AI_CACHE_TTL_SECONDS: z.coerce.number().default(3600),
  AI_MAX_RETRIES_PER_PROVIDER: z.coerce.number().default(2),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.flatten().fieldErrors}`
    );
  }
  cached = parsed.data;
  return cached;
}

export function getConfiguredAiProviders(): Array<
  "groq" | "gemini" | "openrouter"
> {
  const env = getEnv();
  const priority = env.AI_PROVIDER_PRIORITY.split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean) as Array<"groq" | "gemini" | "openrouter">;

  return priority.filter((name) => {
    if (name === "groq") return getGroqApiKeys().length > 0;
    if (name === "gemini") return Boolean(env.GEMINI_API_KEY);
    if (name === "openrouter") return Boolean(env.OPENROUTER_API_KEY);
    return false;
  });
}

/** Ordered unique Groq API keys for failover on rate limits. */
export function getGroqApiKeys(): string[] {
  const env = getEnv();
  const fromList = (env.GROQ_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const keys = [env.GROQ_API_KEY, env.GROQ_API_KEY_2, ...fromList]
    .map((k) => k?.trim() ?? "")
    .filter(Boolean);
  return [...new Set(keys)];
}
