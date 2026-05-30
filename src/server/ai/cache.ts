import { getEnv } from "@/lib/env";

type CacheEntry<T> = { value: T; expiresAt: number };

const memoryCache = new Map<string, CacheEntry<unknown>>();

export function getFromCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCache<T>(key: string, value: T): void {
  const ttl = getEnv().AI_CACHE_TTL_SECONDS * 1000;
  memoryCache.set(key, { value, expiresAt: Date.now() + ttl });
}

export function cacheKey(
  organizationId: string,
  taskType: string,
  contentHash: string
): string {
  return `ai:${organizationId}:${taskType}:${contentHash}`;
}

export function clearCache(): void {
  memoryCache.clear();
}
