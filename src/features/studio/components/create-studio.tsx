"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IntegrationCredentialModal } from "@/features/automations/components/integration-credential-modal";
import { SheetPermissionModal } from "@/features/google-sheets/components/sheet-permission-modal";
import { useIntegrationStatus } from "@/features/automations/hooks/use-integration-status";
import type { IntegrationRequirement } from "@/lib/automation/definitions";
import { automationClient } from "@/services/automation-client";
import { cn } from "@/lib/utils";
import {
  parseSheetSyncMinutesFromPrompt,
  promptRequestsSheetAutoUpdate,
} from "@/lib/studio/parse-sheet-sync-minutes";

type JobTask = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "blocked" | "failed";
  detail?: string;
};

type JobSnapshot = {
  id: string;
  status: "running" | "needs_permission" | "ready" | "failed";
  tasks: JobTask[];
  permission: {
    integration: IntegrationRequirement;
    reconnectUrl: string;
    message: string;
  } | null;
  plan: {
    name: string;
    description: string;
    sheetTitle: string;
    syncMinutes: number;
    starredOnly: boolean;
    columnsFromUser: boolean;
    columns: Array<{ key: string; label: string; hint?: string }>;
    triggerType: string;
    needsSheet: boolean;
  };
  sheet: {
    id: string;
    spreadsheetUrl: string | null;
    sheetTitle: string;
    extractionTableId: string;
    extractionTableName: string;
    autoSyncOn?: boolean;
    syncMinutes?: number;
    setupNote?: string;
  } | null;
  automation: { id: string; name: string; status: string } | null;
  error: string | null;
};

type RunStep = {
  id: string;
  label: string | null;
  nodeType: string;
  status: string;
  errorMessage?: string | null;
};

const EXAMPLES = [
  "Create a Google Sheet that collects Name and Phone Number from starred Gmail and auto-fetches every 1 minute.",
  "When I star a Gmail, extract the lead into a Google Sheet named Lead Tracker with columns Name, Company, Email.",
  "Build a sheet from starred emails, columns: Customer, Order ID, Amount — sync every 1 min.",
];

const SYNC_INTERVAL_OPTIONS = [
  { value: 1, label: "Every 1 minute" },
  { value: 2, label: "Every 2 minutes" },
  { value: 5, label: "Every 5 minutes" },
  { value: 10, label: "Every 10 minutes" },
  { value: 15, label: "Every 15 minutes" },
  { value: 30, label: "Every 30 minutes" },
  { value: 60, label: "Every 60 minutes" },
] as const;

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: { error?: { message?: string }; data?: T };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(
      res.status >= 500
        ? `Server error (${res.status}). Try again.`
        : "Unexpected response from server."
    );
  }
  if (json.error) throw new Error(json.error.message || "Request failed");
  if (!json.data) throw new Error("Request failed");
  return json.data;
}

export function CreateStudio() {
  const [prompt, setPrompt] = useState(EXAMPLES[0]!);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(1);
  const [phase, setPhase] = useState<
    "idle" | "building" | "permissions" | "ready" | "testing"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [credentialModal, setCredentialModal] =
    useState<IntegrationRequirement | null>(null);
  const [sheetPermission, setSheetPermission] = useState<{
    exportId: string;
    reconnectUrl: string;
  } | null>(null);
  const { status: integrationStatus, refresh: refreshIntegrations } =
    useIntegrationStatus();
  const [testSteps, setTestSteps] = useState<RunStep[]>([]);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const asksForAutoUpdate = useMemo(
    () => promptRequestsSheetAutoUpdate(prompt),
    [prompt]
  );

  useEffect(() => {
    if (!asksForAutoUpdate) return;
    const fromPrompt = parseSheetSyncMinutesFromPrompt(prompt);
    if (fromPrompt != null) setSyncIntervalMinutes(fromPrompt);
  }, [prompt, asksForAutoUpdate]);

  const handleJobSnapshot = useCallback((snap: JobSnapshot) => {
    setJob(snap);
    if (snap.status === "needs_permission" && snap.permission) {
      setPhase("permissions");
      if (snap.permission.integration === "GMAIL" && snap.sheet?.id) {
        setSheetPermission({
          exportId: snap.sheet.id,
          reconnectUrl: snap.permission.reconnectUrl,
        });
        setCredentialModal(null);
      } else {
        setCredentialModal(snap.permission.integration);
        setSheetPermission(null);
      }
      return;
    }
    if (snap.status === "ready") {
      setPhase("ready");
      setCredentialModal(null);
      setSheetPermission(null);
      return;
    }
    if (snap.status === "failed") {
      setPhase("idle");
      setError(snap.error || "Build failed");
      return;
    }
    setPhase("building");
  }, []);

  const continueJob = useCallback(
    async (jobId: string) => {
      const snap = await postJson<JobSnapshot>(`/api/v1/studio/jobs/${jobId}`);
      handleJobSnapshot(snap);
    },
    [handleJobSnapshot]
  );

  const build = useCallback(async () => {
    setPhase("building");
    setError(null);
    setTestSteps([]);
    setTestStatus(null);
    setTestError(null);
    setJob(null);
    setSheetPermission(null);
    setCredentialModal(null);

    try {
      const snap = await postJson<JobSnapshot>("/api/v1/studio/jobs", {
        prompt: prompt.trim(),
        ...(asksForAutoUpdate ? { syncIntervalMinutes } : {}),
      });
      handleJobSnapshot(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("idle");
    }
  }, [prompt, syncIntervalMinutes, asksForAutoUpdate, handleJobSnapshot]);

  const resumeAfterConnect = useCallback(async () => {
    setCredentialModal(null);
    await refreshIntegrations();
    if (!job?.id) {
      await build();
      return;
    }
    setPhase("building");
    await continueJob(job.id);
  }, [build, continueJob, job?.id, refreshIntegrations]);

  async function runTest() {
    if (!job?.automation?.id) return;
    setPhase("testing");
    setTestError(null);
    setTestStatus("Starting test run…");
    setTestSteps([]);
    try {
      const { executionId } = await automationClient.execute(job.automation.id, {
        source: "studio_test",
        body: "Studio test run",
      });
      setTestStatus(`Run ${executionId.slice(0, 8)}…`);

      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const { items } = await automationClient.executions(job.automation!.id);
        const latest = (
          items as Array<{
            id: string;
            status: string;
            errorMessage?: string | null;
            steps?: RunStep[];
          }>
        ).find((ex) => ex.id === executionId) ?? items[0];

        if (!latest) continue;
        const row = latest as {
          status: string;
          errorMessage?: string | null;
          steps?: RunStep[];
        };
        setTestStatus(row.status);
        if (row.steps?.length) setTestSteps(row.steps);
        if (row.errorMessage) setTestError(row.errorMessage);
        if (
          row.status === "SUCCESS" ||
          row.status === "FAILED" ||
          row.status === "COMPLETED" ||
          row.status === "WAITING_APPROVAL"
        ) {
          break;
        }
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setPhase("ready");
    }
  }

  const ready = job?.status === "ready";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ask AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe the product. AI plans tasks, asks for Google only when needed,
          then delivers a sheet that auto-fetches on its own.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-border bg-background p-5">
        <label className="block text-sm font-medium">Your prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          placeholder={EXAMPLES[0]}
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted"
            >
              {ex.slice(0, 48)}…
            </button>
          ))}
        </div>

        {asksForAutoUpdate && (
          <label className="block text-sm">
            <span className="font-medium">Auto-fetch interval</span>
            <select
              value={syncIntervalMinutes}
              onChange={(e) => setSyncIntervalMinutes(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {SYNC_INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          disabled={phase === "building" || prompt.trim().length < 8}
          onClick={() => void build()}
          className="w-full rounded-xl bg-foreground py-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
        >
          {phase === "building" ? "Building product…" : "Build my product"}
        </button>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
      </section>

      {job && (
        <section className="space-y-3 rounded-2xl border border-border bg-background p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI task list
            </p>
            <h2 className="mt-1 text-lg font-semibold">{job.plan.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {job.plan.description}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Sheet: <strong>{job.plan.sheetTitle}</strong>
              {job.plan.starredOnly ? " · starred Gmail only" : ""}
              {` · every ${job.plan.syncMinutes} min`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {job.plan.columnsFromUser ? "Your headings: " : "AI headings: "}
              {job.plan.columns.map((c) => c.label).join(", ")}
            </p>
          </div>

          <ol className="space-y-2">
            {job.tasks.map((t, i) => (
              <li
                key={t.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm",
                  t.status === "done" && "border-emerald-500/40 bg-emerald-500/5",
                  t.status === "running" && "border-blue-500/40 bg-blue-500/5",
                  t.status === "blocked" && "border-amber-500/40 bg-amber-500/5",
                  t.status === "failed" && "border-red-500/40 bg-red-500/5",
                  t.status === "pending" && "border-border"
                )}
              >
                <span className="mt-0.5 w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">
                  {t.status === "done"
                    ? "✓"
                    : t.status === "running"
                      ? "…"
                      : t.status === "blocked"
                        ? "!"
                        : t.status === "failed"
                          ? "×"
                          : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.label}</p>
                  {t.detail && (
                    <p className="mt-0.5 text-xs text-muted-foreground break-all">
                      {t.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {ready && job && (
        <section className="space-y-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Your product is ready
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {job.automation?.name || job.plan.name}
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {job.automation?.status ?? "ACTIVE"}
              {job.sheet?.autoSyncOn
                ? ` · auto-fetch every ${job.sheet.syncMinutes ?? job.plan.syncMinutes} min`
                : ""}
              {" · "}
              no further setup needed
            </p>
          </div>

          {job.sheet?.spreadsheetUrl && (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Google Sheet
              </p>
              <a
                href={job.sheet.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm font-medium text-emerald-700 underline dark:text-emerald-300"
              >
                {job.sheet.spreadsheetUrl}
              </a>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Starred Gmail → Gemini AI → this sheet, every{" "}
                {job.sheet.syncMinutes ?? job.plan.syncMinutes} min inside Google.
                You don’t need to keep InboxFlow open or change the sheet.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={phase === "testing"}
              onClick={() => void runTest()}
              className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {phase === "testing" ? "Testing…" : "Test run"}
            </button>
            {job.automation && (
              <Link
                href={`/automations/${job.automation.id}`}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                Open workflow
              </Link>
            )}
            {job.sheet?.spreadsheetUrl && (
              <a
                href={job.sheet.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                Open sheet
              </a>
            )}
          </div>

          {(testStatus || testSteps.length > 0 || testError) && (
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Test visualization
              </p>
              <p className="mt-1 text-sm">
                Status: <span className="font-semibold">{testStatus ?? "—"}</span>
              </p>
              {testError && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  {testError}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <IntegrationCredentialModal
        open={credentialModal !== null}
        integration={credentialModal ?? "GMAIL"}
        node={null}
        gmailReconnectUrl={
          job?.permission?.reconnectUrl ||
          integrationStatus.gmail.reconnectUrl ||
          "/api/v1/integrations/gmail/connect?reconnect=1"
        }
        whatsappEncryptionReady={integrationStatus.whatsapp.encryptionReady}
        twilioEncryptionReady={integrationStatus.twilio.encryptionReady}
        onConnected={() => void resumeAfterConnect()}
        onCancel={() => setCredentialModal(null)}
      />

      {sheetPermission && (
        <SheetPermissionModal
          exportId={sheetPermission.exportId}
          reconnectUrl={sheetPermission.reconnectUrl}
          onDone={() => {
            setSheetPermission(null);
            if (job?.id) void continueJob(job.id);
          }}
          onCancel={() => setSheetPermission(null)}
        />
      )}
    </div>
  );
}
