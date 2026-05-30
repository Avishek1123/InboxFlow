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

    const { organizationId, messageId, message, forceRefresh, replyTone } =
      parsed.data;
    const tasks =
      parsed.data.tasks ??
      parsed.data.task ??
      inferDefaultTasks(message.channel);

    const results = await aiService.analyze({
      organizationId,
      messageId,
      tasks,
      message,
      forceRefresh,
      replyTone,
    });

    return apiSuccess({ results });
  } catch (err) {
    return handleAiError(err);
  }
}

function inferDefaultTasks(
  channel: "GMAIL" | "WHATSAPP"
): Array<
  | "SUMMARIZE_EMAIL"
  | "SUMMARIZE_WHATSAPP"
  | "SENTIMENT"
  | "INTENT"
> {
  return [
    channel === "GMAIL" ? "SUMMARIZE_EMAIL" : "SUMMARIZE_WHATSAPP",
    "SENTIMENT",
    "INTENT",
  ];
}

function handleAiError(err: unknown) {
  if (err instanceof AiError) {
    return apiError(err.code, err.message, err.statusCode);
  }
  console.error("[AI analyze]", err);
  return apiError("INTERNAL_ERROR", "AI processing failed", 500);
}
