import type { AiProviderName } from "@prisma/client";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompletionRequest = {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
};

export type CompletionResult = {
  content: string;
  provider: AiProviderName;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
};

export interface AiProviderAdapter {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
