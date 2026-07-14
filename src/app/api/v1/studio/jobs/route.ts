import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { planStudioProduct } from "@/server/studio/plan-product";
import { createStudioJob } from "@/server/studio/job-store";
import { continueStudioJob } from "@/server/studio/run-job-step";

export const runtime = "nodejs";
export const maxDuration = 120;

const createSchema = z.object({
  prompt: z.string().min(8).max(4000),
  syncIntervalMinutes: z.number().int().min(1).max(60).optional(),
});

/** Create a studio job: plan tasks, then run the first executable step. */
export async function POST(request: Request) {
  try {
    const { organization, user } = await requireOrganization();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid prompt", 400, parsed.error.flatten());
    }

    const plan = await planStudioProduct({
      organizationId: organization.id,
      prompt: parsed.data.prompt,
      syncIntervalMinutes: parsed.data.syncIntervalMinutes,
    });

    const job = await createStudioJob({
      organizationId: organization.id,
      userId: user.id,
      prompt: parsed.data.prompt,
      plan,
    });

    try {
      const { ensureSheetKeepAliveWorker } = await import(
        "@/server/google-sheets/sheet-keepalive"
      );
      ensureSheetKeepAliveWorker();
    } catch {
      /* ignore */
    }

    const requestOrigin = new URL(request.url).origin;
    const progressed = await continueStudioJob({
      jobId: job.id,
      organizationId: organization.id,
      requestOrigin,
    });

    return apiSuccess(progressed);
  } catch (err) {
    console.error("[studio/jobs]", err);
    return apiError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Could not start product build",
      500
    );
  }
}
