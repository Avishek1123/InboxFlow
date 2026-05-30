import type { MessageChannel } from "@prisma/client";

export type AiTaskTypeName =
  | "SUMMARIZE_EMAIL"
  | "SUMMARIZE_WHATSAPP"
  | "EXTRACT_LEAD"
  | "EXTRACT_ORDER"
  | "EXTRACT_INVOICE"
  | "SENTIMENT"
  | "INTENT"
  | "AUTO_REPLY"
  | "FULL_ANALYSIS";

export type MessageInput = {
  channel: MessageChannel;
  subject?: string | null;
  body: string;
  fromAddress?: string;
  receivedAt?: string;
};

export type AiAnalyzeRequest = {
  organizationId: string;
  messageId?: string;
  task?: AiTaskTypeName;
  tasks?: AiTaskTypeName | AiTaskTypeName[];
  message: MessageInput;
  /** Skip cache lookup */
  forceRefresh?: boolean;
  /** Brand voice hint for auto-reply */
  replyTone?: "professional" | "friendly" | "concise";
};

export type AiAnalyzeResponse = {
  task: AiTaskTypeName;
  result: unknown;
  provider: string;
  model: string;
  cached: boolean;
  latencyMs: number;
};
