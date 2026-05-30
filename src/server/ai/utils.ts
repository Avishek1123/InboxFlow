import { createHash } from "crypto";
import { getEnv } from "@/lib/env";
import type { MessageInput } from "@/types/ai";

export function truncateInput(text: string): string {
  const max = getEnv().AI_MAX_INPUT_CHARS;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[...truncated for token optimization]`;
}

export function hashContent(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export function buildMessageContext(message: MessageInput): string {
  const parts: string[] = [`Channel: ${message.channel}`];
  if (message.fromAddress) parts.push(`From: ${message.fromAddress}`);
  if (message.subject) parts.push(`Subject: ${message.subject}`);
  if (message.receivedAt) parts.push(`Received: ${message.receivedAt}`);
  parts.push("", truncateInput(message.body));
  return parts.join("\n");
}

export function extractJsonFromResponse(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
