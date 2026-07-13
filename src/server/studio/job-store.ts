import type { StudioProductPlan, StudioTaskId } from "@/server/studio/plan-product";
import type { WorkflowGraph } from "@/types/automation";

export type StudioJobTaskStatus = "pending" | "running" | "done" | "blocked" | "failed";

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
  status: "running" | "needs_permission" | "ready" | "failed";
  permission?: {
    integration: "GMAIL" | "WHATSAPP" | "TWILIO";
    reconnectUrl: string;
    message: string;
  };
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
  permissions: "Connect Google (if needed)",
  create_table: "Create data table with headings",
  create_sheet: "Create Google Sheet",
  install_script: "Install starred-mail → AI script",
  enable_autosync: "Enable 1-min auto-sync timer",
  backfill: "Import all starred emails",
  activate: "Activate product",
};

type GlobalJobs = { __inboxflowStudioJobs?: Map<string, StudioJob> };

function store(): Map<string, StudioJob> {
  const g = globalThis as unknown as GlobalJobs;
  if (!g.__inboxflowStudioJobs) g.__inboxflowStudioJobs = new Map();
  return g.__inboxflowStudioJobs;
}

export function createStudioJob(params: {
  organizationId: string;
  userId: string;
  prompt: string;
  plan: StudioProductPlan;
}): StudioJob {
  const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const tasks: StudioJobTask[] = params.plan.tasks.map((tid, i) => ({
    id: tid,
    label: TASK_LABELS[tid],
    status: i === 0 ? "done" : "pending",
    detail:
      tid === "plan"
        ? params.plan.columnsFromUser
          ? `Using your headings: ${params.plan.columns.map((c) => c.label).join(", ")}`
          : `AI chose headings: ${params.plan.columns.map((c) => c.label).join(", ")}`
        : undefined,
  }));

  // plan task already completed by planStudioProduct
  const planIdx = tasks.findIndex((t) => t.id === "plan");
  if (planIdx >= 0) tasks[planIdx]!.status = "done";

  const job: StudioJob = {
    id,
    organizationId: params.organizationId,
    userId: params.userId,
    prompt: params.prompt,
    plan: params.plan,
    tasks,
    cursor: Math.max(0, params.plan.tasks.indexOf("plan") + 1),
    status: "running",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  store().set(id, job);
  return job;
}

export function getStudioJob(id: string): StudioJob | null {
  return store().get(id) ?? null;
}

export function saveStudioJob(job: StudioJob): StudioJob {
  job.updatedAt = Date.now();
  store().set(job.id, job);
  return job;
}

export function publicStudioJob(job: StudioJob) {
  return {
    id: job.id,
    status: job.status,
    cursor: job.cursor,
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
