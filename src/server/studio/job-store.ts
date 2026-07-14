import type { Prisma } from "@prisma/client";
import type { StudioProductPlan, StudioTaskId } from "@/server/studio/plan-product";
import type { WorkflowGraph } from "@/types/automation";
import { prisma } from "@/server/db";

export type StudioJobTaskStatus =
  | "pending"
  | "running"
  | "done"
  | "blocked"
  | "failed";

export type StudioJobTask = {
  id: StudioTaskId;
  label: string;
  status: StudioJobTaskStatus;
  detail?: string;
};

export type StudioJob = {
  id: string;
  organizationId: string;
  userId: string;
  prompt: string;
  plan: StudioProductPlan;
  tasks: StudioJobTask[];
  cursor: number;
  status:
    | "running"
    | "needs_permission"
    | "awaiting_autosync"
    | "ready"
    | "failed";
  permission?: {
    integration: "GMAIL" | "WHATSAPP" | "TWILIO";
    reconnectUrl: string;
    message: string;
  };
  /** User clicked "Enable auto-sync" in the studio UI. */
  autosyncConfirmed?: boolean;
  graph?: WorkflowGraph;
  tableId?: string;
  tableName?: string;
  exportId?: string;
  spreadsheetUrl?: string | null;
  appsScriptId?: string;
  autoSyncOn?: boolean;
  automationId?: string;
  automationName?: string;
  automationStatus?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

const TASK_LABELS: Record<StudioTaskId, string> = {
  plan: "Understand prompt & headings",
  permissions: "Connect Google (full access)",
  create_table: "Create data table with headings",
  collect_data: "Collect starred emails & extract data",
  create_sheet: "Create Google Sheet with your data",
  enable_autosync: "Enable auto-sync (your click)",
  activate: "Activate product",
};

type GlobalJobs = { __inboxflowStudioJobs?: Map<string, StudioJob> };

function memoryStore(): Map<string, StudioJob> {
  const g = globalThis as unknown as GlobalJobs;
  if (!g.__inboxflowStudioJobs) g.__inboxflowStudioJobs = new Map();
  return g.__inboxflowStudioJobs;
}

async function persistJob(job: StudioJob) {
  memoryStore().set(job.id, job);
  const payload = job as unknown as Prisma.InputJsonValue;
  await prisma.studioJob.upsert({
    where: { id: job.id },
    create: {
      id: job.id,
      organizationId: job.organizationId,
      userId: job.userId,
      payload,
    },
    update: { payload },
  });
}

async function loadJobFromDb(id: string): Promise<StudioJob | null> {
  try {
    const row = await prisma.studioJob.findUnique({ where: { id } });
    if (!row?.payload || typeof row.payload !== "object") return null;
    return row.payload as unknown as StudioJob;
  } catch (err) {
    console.error("[studio-job] load failed:", err);
    return null;
  }
}

export async function createStudioJob(params: {
  organizationId: string;
  userId: string;
  prompt: string;
  plan: StudioProductPlan;
}): Promise<StudioJob> {
  const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const tasks: StudioJobTask[] = params.plan.tasks.map((tid) => ({
    id: tid,
    label: TASK_LABELS[tid],
    status: tid === "plan" ? "done" : "pending",
    detail:
      tid === "plan"
        ? params.plan.columnsFromUser
          ? `Using your headings: ${params.plan.columns.map((c) => c.label).join(", ")}`
          : `AI chose headings: ${params.plan.columns.map((c) => c.label).join(", ")}`
        : undefined,
  }));

  const planIdx = params.plan.tasks.indexOf("plan");
  const job: StudioJob = {
    id,
    organizationId: params.organizationId,
    userId: params.userId,
    prompt: params.prompt,
    plan: params.plan,
    tasks,
    cursor: Math.max(0, planIdx + 1),
    status: "running",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await persistJob(job);
  return job;
}

export async function getStudioJob(id: string): Promise<StudioJob | null> {
  // Prefer DB so Next.js hot-reloads / multi-worker don't drop mid-build jobs.
  const fromDb = await loadJobFromDb(id);
  if (fromDb) {
    memoryStore().set(id, fromDb);
    return fromDb;
  }
  return memoryStore().get(id) ?? null;
}

export async function saveStudioJob(job: StudioJob): Promise<StudioJob> {
  job.updatedAt = Date.now();
  await persistJob(job);
  return job;
}

export function publicStudioJob(job: StudioJob) {
  const doneCount = job.tasks.filter((t) => t.status === "done").length;
  return {
    id: job.id,
    status: job.status,
    cursor: job.cursor,
    progress: {
      done: doneCount,
      total: job.tasks.length,
      percent: Math.round((doneCount / Math.max(1, job.tasks.length)) * 100),
    },
    tasks: job.tasks,
    permission: job.permission ?? null,
    plan: {
      name: job.plan.name,
      description: job.plan.description,
      sheetTitle: job.plan.sheetTitle,
      syncMinutes: job.plan.syncMinutes,
      starredOnly: job.plan.starredOnly,
      columnsFromUser: job.plan.columnsFromUser,
      columns: job.plan.columns,
      triggerType: job.plan.triggerType,
      needsSheet: job.plan.needsSheet,
    },
    sheet: job.exportId
      ? {
          id: job.exportId,
          spreadsheetUrl: job.spreadsheetUrl ?? null,
          sheetTitle: job.plan.sheetTitle,
          extractionTableId: job.tableId!,
          extractionTableName: job.tableName!,
          autoSyncOn: Boolean(job.autoSyncOn),
          syncMinutes: job.plan.syncMinutes,
          setupNote: job.tasks.find((t) => t.id === "enable_autosync")?.detail,
        }
      : null,
    automation: job.automationId
      ? {
          id: job.automationId,
          name: job.automationName || job.plan.name,
          status: job.automationStatus || "DRAFT",
        }
      : null,
    error: job.error ?? null,
  };
}
