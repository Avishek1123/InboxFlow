export class AiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 500,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AiError";
  }
}

export class AiRateLimitError extends AiError {
  constructor(retryAfterSeconds: number) {
    super(
      `AI rate limit exceeded. Retry after ${retryAfterSeconds}s.`,
      "AI_RATE_LIMIT",
      429
    );
  }
}

export class AiProviderError extends AiError {
  constructor(provider: string, message: string, cause?: unknown) {
    super(`${provider}: ${message}`, "AI_PROVIDER_ERROR", 502, cause);
  }
}

export class AiParseError extends AiError {
  constructor(message: string, cause?: unknown) {
    super(message, "AI_PARSE_ERROR", 422, cause);
  }
}

export class AiConfigError extends AiError {
  constructor(message: string) {
    super(message, "AI_NOT_CONFIGURED", 503);
  }
}
