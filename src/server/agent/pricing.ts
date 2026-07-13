/** Approximate USD per 1M tokens for cost estimates (paid tiers). */
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
  "openai/gpt-4o": { input: 2.5, output: 10 },
  "anthropic/claude-3.5-sonnet": { input: 3, output: 15 },
  default: { input: 0.3, output: 2.5 },
};

export function estimateCostUsd(params: {
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): number {
  const key = params.model?.toLowerCase() ?? "default";
  const pricing =
    Object.entries(PRICING).find(([m]) => key.includes(m))?.[1] ??
    PRICING.default!;
  const input = params.inputTokens ?? 0;
  const output = params.outputTokens ?? 0;
  return (input * pricing.input + output * pricing.output) / 1_000_000;
}

export function formatUsd(amount: number): string {
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
