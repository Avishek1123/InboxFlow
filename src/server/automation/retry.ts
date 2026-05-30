const BASE_MS = 2000;

export function computeNextRetryAt(retryCount: number): Date {
  const delayMs = BASE_MS * Math.pow(2, retryCount);
  return new Date(Date.now() + delayMs);
}

export function shouldRetry(retryCount: number, maxRetries: number): boolean {
  return retryCount < maxRetries;
}
