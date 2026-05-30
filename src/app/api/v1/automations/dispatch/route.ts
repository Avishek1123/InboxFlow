import { apiError, apiSuccess } from "@/lib/api-response";
import { dispatchEventSchema } from "@/lib/validations/automation";
import { automationDispatcher } from "@/server/automation/dispatcher";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = dispatchEventSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
  }

  const executionIds = await automationDispatcher.dispatch(parsed.data);
  return apiSuccess({ executionIds, count: executionIds.length });
}
