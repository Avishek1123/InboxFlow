import type { AiTaskType } from "@prisma/client";
import type { MessageInput } from "@/types/ai";
import { buildMessageContext } from "../utils";
import { BASE_SYSTEM_PROMPT } from "./system";
import { TASK_PROMPTS } from "./tasks";

export function buildPrompt(
  task: AiTaskType,
  message: MessageInput,
  options?: { replyTone?: string }
): { system: string; user: string } {
  let taskPrompt = TASK_PROMPTS[task];
  if (task === "AUTO_REPLY" && options?.replyTone) {
    taskPrompt += `\nUse a ${options.replyTone} tone.`;
  }

  return {
    system: `${BASE_SYSTEM_PROMPT}\n\n${taskPrompt}`,
    user: buildMessageContext(message),
  };
}
