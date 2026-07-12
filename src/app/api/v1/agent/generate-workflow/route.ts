import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { generateWorkflowFromPrompt } from "@/server/agent";
import { automationRepository } from "@/server/repositories/automation.repository";
import type { AutomationTriggerType } from "@prisma/client";

export const runtime = "nodejs";

const bodySchema = z.object({
  prompt: z.string().min(8).max(4000),
  save: z.boolean().optional(),
  activate: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const { organization } = await requireOrganization();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
    }

    const draft = await generateWorkflowFromPrompt({
      organizationId: organization.id,
      prompt: parsed.data.prompt,
    });

    let automation = null;
    if (parsed.data.save) {
      const triggerType = (
        [
          "NEW_GMAIL_EMAIL",
          "NEW_WHATSAPP_MESSAGE",
          "NEW_SMS",
          "NEW_TWILIO_WHATSAPP",
          "SCHEDULED_TIME",
          "AI_EXTRACTION_COMPLETED",
        ].includes(draft.triggerType)
          ? draft.triggerType
          : "NEW_GMAIL_EMAIL"
      ) as AutomationTriggerType;

      automation = await automationRepository.create({
        organizationId: organization.id,
        name: draft.name,
        description: draft.description,
        triggerType,
        graph: draft.graph,
      });

      if (parsed.data.activate) {
        automation = await automationRepository.update(automation.id, {
          status: "ACTIVE",
        });
      }
    }

    return apiSuccess({ draft, automation });
  } catch (err) {
    console.error("[agent/generate-workflow]", err);
    return apiError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Generation failed",
      500
    );
  }
}
