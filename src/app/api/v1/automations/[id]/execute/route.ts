import { apiError, apiSuccess } from "@/lib/api-response";
import { testRunSchema } from "@/lib/validations/automation";
import { automationExecutor } from "@/server/automation/executor";
import { automationRepository } from "@/server/repositories/automation.repository";
import type { AutomationTriggerPayload } from "@/types/automation";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const automation = await automationRepository.findById(id);
    if (!automation) return apiError("NOT_FOUND", "Automation not found", 404);

    const body = await request.json().catch(() => ({}));
    const parsed = testRunSchema.safeParse(body);

    const defaultPayload: AutomationTriggerPayload = {
      channel:
        automation.triggerType === "NEW_WHATSAPP_MESSAGE"
          ? "WHATSAPP"
          : "GMAIL",
      from: "test@example.com",
      subject: "Test trigger",
      body: "This is a test message for automation dry-run.",
      receivedAt: new Date().toISOString(),
    };

    const triggerPayload = {
      ...defaultPayload,
      ...(parsed.success && parsed.data.payload
        ? parsed.data.payload
        : {}),
    } as AutomationTriggerPayload;

    const executionId = await automationExecutor.run({
      automation,
      triggerPayload,
    });

    return apiSuccess({ executionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Execution failed";
    return apiError("EXECUTION_FAILED", msg, 500);
  }
}
