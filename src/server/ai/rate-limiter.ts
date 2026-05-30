import { getEnv } from "@/lib/env";
import { AiRateLimitError } from "./errors";

type WindowEntry = { count: number; windowStart: number };

const windows = new Map<string, WindowEntry>();

const WINDOW_MS = 60_000;

export function checkRateLimit(organizationId: string): void {
  const limit = getEnv().AI_RATE_LIMIT_PER_ORG_PER_MINUTE;
  const now = Date.now();
  const key = organizationId;

  let entry = windows.get(key);
  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    windows.set(key, entry);
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil(
      (WINDOW_MS - (now - entry.windowStart)) / 1000
    );
    throw new AiRateLimitError(retryAfter);
  }

  entry.count += 1;
}

export function resetRateLimitForTests(): void {
  windows.clear();
}
