import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import {
  getStudioJob,
  publicStudioJob,
  saveStudioJob,
} from "@/server/studio/job-store";
import { continueStudioJob } from "@/server/studio/run-job-step";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { organization } = await requireOrganization();
    const { id } = await params;
    const job = await getStudioJob(id);
    if (!job || job.organizationId !== organization.id) {
      return apiError("NOT_FOUND", "Job not found", 404);
    }
    return apiSuccess(publicStudioJob(job));
  } catch (err) {
    return apiError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Failed",
      500
    );
  }
}

/** Resume after permissions, or advance the next single task. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { organization } = await requireOrganization();
    const { id } = await params;
    const job = await getStudioJob(id);
    if (!job || job.organizationId !== organization.id) {
      return apiError("NOT_FOUND", "Job not found. Start the build again.", 404);
    }

    let body: { timerInstalled?: boolean } = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text) as typeof body;
    } catch {
      /* empty body is fine */
    }

    // Sheet permission modal may have already turned the timer on.
    if (body.timerInstalled) {
      job.autoSyncOn = true;
      await saveStudioJob(job);
    } else if (job.exportId && !job.autoSyncOn) {
      try {
        const { sheetExportRepository } = await import(
          "@/server/repositories/sheet-export.repository"
        );
        const row = (await sheetExportRepository.list(organization.id)).find(
          (e) => e.id === job.exportId
        );
        if (row?.appsScriptId) {
          job.appsScriptId = row.appsScriptId;
          await saveStudioJob(job);
        }
      } catch {
        /* ignore */
      }
    }

    const requestOrigin = new URL(request.url).origin;
    const progressed = await continueStudioJob({
      jobId: id,
      organizationId: organization.id,
      requestOrigin,
    });
    return apiSuccess(progressed);
  } catch (err) {
    console.error("[studio/jobs continue]", err);
    return apiError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Continue failed",
      500
    );
  }
}
