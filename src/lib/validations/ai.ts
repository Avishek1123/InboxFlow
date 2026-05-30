import { z } from "zod";

export const messageInputSchema = z.object({
  channel: z.enum(["GMAIL", "WHATSAPP"]),
  subject: z.string().nullable().optional(),
  body: z.string().min(1).max(50_000),
  fromAddress: z.string().optional(),
  receivedAt: z.string().optional(),
});

export const aiAnalyzeBodySchema = z.object({
  organizationId: z.string().min(1),
  messageId: z.string().optional(),
  task: z
    .union([
      z.enum([
        "SUMMARIZE_EMAIL",
        "SUMMARIZE_WHATSAPP",
        "EXTRACT_LEAD",
        "EXTRACT_ORDER",
        "EXTRACT_INVOICE",
        "SENTIMENT",
        "INTENT",
        "AUTO_REPLY",
        "FULL_ANALYSIS",
      ]),
      z.array(
        z.enum([
          "SUMMARIZE_EMAIL",
          "SUMMARIZE_WHATSAPP",
          "EXTRACT_LEAD",
          "EXTRACT_ORDER",
          "EXTRACT_INVOICE",
          "SENTIMENT",
          "INTENT",
          "AUTO_REPLY",
          "FULL_ANALYSIS",
        ])
      ),
    ])
    .optional(),
  tasks: z
    .array(
      z.enum([
        "SUMMARIZE_EMAIL",
        "SUMMARIZE_WHATSAPP",
        "EXTRACT_LEAD",
        "EXTRACT_ORDER",
        "EXTRACT_INVOICE",
        "SENTIMENT",
        "INTENT",
        "AUTO_REPLY",
        "FULL_ANALYSIS",
      ])
    )
    .optional(),
  message: messageInputSchema,
  forceRefresh: z.boolean().optional(),
  replyTone: z.enum(["professional", "friendly", "concise"]).optional(),
});

export type AiAnalyzeBody = z.infer<typeof aiAnalyzeBodySchema>;
