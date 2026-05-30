import { apiError, apiSuccess } from "@/lib/api-response";
import { z } from "zod";
import { messageInputSchema } from "@/lib/validations/ai";
import { AiError } from "@/server/ai";
import { aiService } from "@/server/ai/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const extractBodySchema = z.object({
  organizationId: z.string().min(1),
  messageId: z.string().optional(),
  type: z.enum(["lead", "order", "invoice", "all"]),
  message: messageInputSchema,
  forceRefresh: z.boolean().optional(),
});

const typeToTask = {
  lead: "EXTRACT_LEAD",
  order: "EXTRACT_ORDER",
  invoice: "EXTRACT_INVOICE",
  all: "FULL_ANALYSIS",
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = extractBodySchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        parsed.error.flatten()
      );
    }

    const task = typeToTask[parsed.data.type];
    const results = await aiService.analyze({
      organizationId: parsed.data.organizationId,
      messageId: parsed.data.messageId,
      tasks: task,
      message: parsed.data.message,
      forceRefresh: parsed.data.forceRefresh,
    });

    return apiSuccess({
      type: parsed.data.type,
      results: parsed.data.type === "all" ? results[0] : results,
    });
  } catch (err) {
    if (err instanceof AiError) {
      return apiError(err.code, err.message, err.statusCode);
    }
    console.error("[AI extract]", err);
    return apiError("INTERNAL_ERROR", "Extraction failed", 500);
  }
}
