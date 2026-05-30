import { apiError, apiSuccess } from "@/lib/api-response";
import { aiAnalyzeBodySchema } from "@/lib/validations/ai";
import { AiError } from "@/server/ai";
import { aiService } from "@/server/ai/service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = aiAnalyzeBodySchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid request body",
        400,
        parsed.error.flatten()
      );
    }

    const results = await aiService.analyze({
      organizationId: parsed.data.organizationId,
      messageId: parsed.data.messageId,
      tasks: "AUTO_REPLY",
      message: parsed.data.message,
      forceRefresh: parsed.data.forceRefresh,
      replyTone: parsed.data.replyTone ?? "professional",
    });

    return apiSuccess({ result: results[0] });
  } catch (err) {
    if (err instanceof AiError) {
      return apiError(err.code, err.message, err.statusCode);
    }
    console.error("[AI auto-reply]", err);
    return apiError("INTERNAL_ERROR", "Auto-reply generation failed", 500);
  }
}
