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
    const job = getStudioJob(id);
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

/** Resume after permissions, or advance the next task. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { organization } = await requireOrganization();
    const { id } = await params;
    const job = getStudioJob(id);
    if (!job || job.organizationId !== organization.id) {
      return apiError("NOT_FOUND", "Job not found", 404);
    }

    job.tasks = job.tasks.map((t) =>
      t.status === "blocked" ? { ...t, status: "pending", detail: undefined } : t
    );
    job.status = "running";
    job.permission = undefined;
    const nextIdx = job.tasks.findIndex((t) => t.status !== "done");
    if (nextIdx >= 0) job.cursor = nextIdx;
    saveStudioJob(job);

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
