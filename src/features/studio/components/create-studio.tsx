"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IntegrationCredentialModal } from "@/features/automations/components/integration-credential-modal";
import { StudioTaskProgress } from "@/features/studio/components/studio-task-progress";
import { useIntegrationStatus } from "@/features/automations/hooks/use-integration-status";
import type { IntegrationRequirement } from "@/lib/automation/definitions";
import { automationClient } from "@/services/automation-client";
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
  status:
    | "running"
    | "needs_permission"
    | "awaiting_autosync"
    | "ready"
    | "failed";
  progress?: { done: number; total: number; percent: number };
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function CreateStudio() {
  const [prompt, setPrompt] = useState(EXAMPLES[0]!);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(1);
  const [phase, setPhase] = useState<
    | "idle"
    | "building"
    | "permissions"
    | "awaiting_autosync"
    | "ready"
    | "testing"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [credentialModal, setCredentialModal] =
    useState<IntegrationRequirement | null>(null);
  const { status: integrationStatus, refresh: refreshIntegrations } =
    useIntegrationStatus();
  const [testSteps, setTestSteps] = useState<RunStep[]>([]);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [enablingAutosync, setEnablingAutosync] = useState(false);

  const jobIdRef = useRef<string | null>(null);
  const advancingRef = useRef(false);
  const cancelledRef = useRef(false);

  const asksForAutoUpdate = useMemo(
    () => promptRequestsSheetAutoUpdate(prompt),
    [prompt]
  );

  useEffect(() => {
    if (!asksForAutoUpdate) return;
    const fromPrompt = parseSheetSyncMinutesFromPrompt(prompt);
    if (fromPrompt != null) setSyncIntervalMinutes(fromPrompt);
  }, [prompt, asksForAutoUpdate]);

  const applyPausedUi = useCallback((snap: JobSnapshot) => {
    setCredentialModal(null);
    if (snap.status === "needs_permission" && snap.permission) {
      setPhase("permissions");
      setCredentialModal(snap.permission.integration);
      return;
    }
    if (snap.status === "awaiting_autosync") {
      setPhase("awaiting_autosync");
      return;
    }
  }, []);

  /** Keep calling continue until ready, failed, needs permission, or awaiting autosync. */
  const advanceUntilPaused = useCallback(
    async (jobId: string, firstSnap?: JobSnapshot) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      cancelledRef.current = false;

      try {
        let snap = firstSnap;
        if (!snap) {
          snap = await postJson<JobSnapshot>(`/api/v1/studio/jobs/${jobId}`);
        }

        while (!cancelledRef.current && snap.status === "running") {
          setJob(snap);
          setPhase("building");
          await sleep(420);
          if (cancelledRef.current) break;
          snap = await postJson<JobSnapshot>(`/api/v1/studio/jobs/${jobId}`);
        }

        if (cancelledRef.current) return;

        setJob(snap);
        jobIdRef.current = snap.id;

        if (
          snap.status === "needs_permission" ||
          snap.status === "awaiting_autosync"
        ) {
          applyPausedUi(snap);
          return;
        }
        if (snap.status === "ready") {
          setPhase("ready");
          setCredentialModal(null);
          return;
        }
        if (snap.status === "failed") {
          setPhase("idle");
          setError(snap.error || "Build failed");
          return;
        }
        setPhase("building");
      } catch (e) {
        cancelledRef.current = true;
        setError(e instanceof Error ? e.message : "Something went wrong");
        setPhase("idle");
      } finally {
        advancingRef.current = false;
      }
    },
    [applyPausedUi]
  );

  const build = useCallback(async () => {
    setPhase("building");
    setError(null);
    setTestSteps([]);
    setTestStatus(null);
    setTestError(null);
    setJob(null);
    setCredentialModal(null);
    jobIdRef.current = null;
    cancelledRef.current = true;
    await sleep(50);
    cancelledRef.current = false;

    try {
      const snap = await postJson<JobSnapshot>("/api/v1/studio/jobs", {
        prompt: prompt.trim(),
        ...(asksForAutoUpdate ? { syncIntervalMinutes } : {}),
      });
      jobIdRef.current = snap.id;
      setJob(snap);

      if (
        snap.status === "needs_permission" ||
        snap.status === "awaiting_autosync"
      ) {
        applyPausedUi(snap);
        return;
      }
      if (snap.status === "ready") {
        setPhase("ready");
        return;
      }
      if (snap.status === "failed") {
        setPhase("idle");
        setError(snap.error || "Build failed");
        return;
      }

      await advanceUntilPaused(snap.id, snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("idle");
    }
  }, [
    prompt,
    syncIntervalMinutes,
    asksForAutoUpdate,
    advanceUntilPaused,
    applyPausedUi,
  ]);

  const resumeAfterPermission = useCallback(async () => {
    const id = jobIdRef.current || job?.id;
    if (!id) {
      await build();
      return;
    }
    setCredentialModal(null);
    setPhase("building");
    setError(null);
    await refreshIntegrations();
    await sleep(600);

    // If we were enabling autosync, resume that path (website-only, not sheet menu).
    const waitingAutosync =
      job?.tasks.some((t) => t.id === "enable_autosync" && t.status !== "done") ??
      false;
    if (waitingAutosync) {
      try {
        const snap = await postJson<JobSnapshot>(`/api/v1/studio/jobs/${id}`, {
          enableAutosync: true,
        });
        setJob(snap);
        if (snap.status === "needs_permission") {
          applyPausedUi(snap);
          return;
        }
        await advanceUntilPaused(id, snap);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not enable auto-sync");
        setPhase("awaiting_autosync");
      }
      return;
    }

    await advanceUntilPaused(id);
  }, [
    advanceUntilPaused,
    applyPausedUi,
    build,
    job?.id,
    job?.tasks,
    refreshIntegrations,
  ]);

  /** Open Google OAuth (all scopes) in a popup, then finish website autosync. */
  const openGoogleThenEnableAutosync = useCallback(async () => {
    const id = jobIdRef.current || job?.id;
    if (!id) return;

    setEnablingAutosync(true);
    setError(null);

    const reconnectUrl =
      job?.permission?.reconnectUrl ||
      integrationStatus.gmail.reconnectUrl ||
      "/api/v1/integrations/gmail/connect?reconnect=1";

    const authorized = await new Promise<boolean>((resolve) => {
      const w = 520;
      const h = 720;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      const url = new URL(reconnectUrl, window.location.origin);
      url.searchParams.set("popup", "1");
      url.searchParams.set("openerOrigin", window.location.origin);
      if (job?.sheet?.id) {
        url.searchParams.set("sheetExportId", job.sheet.id);
      }
      const popup = window.open(
        url.toString(),
        "inboxflow-google-autosync",
        `width=${w},height=${h},left=${left},top=${top}`
      );

      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        window.clearInterval(poll);
        resolve(ok);
      };

      function onMessage(event: MessageEvent) {
        const data = event.data as {
          type?: string;
          ok?: boolean;
        };
        if (data?.type !== "inboxflow-gmail-oauth") return;
        done(Boolean(data.ok));
      }
      window.addEventListener("message", onMessage);

      const poll = window.setInterval(() => {
        if (popup && popup.closed) {
          // Popup closed — try continuing; API will re-check scopes.
          done(true);
        }
      }, 500);

      // Safety timeout
      window.setTimeout(() => done(true), 120_000);
    });

    if (!authorized) {
      setEnablingAutosync(false);
      setError("Google authorization was cancelled. Try Enable auto-sync again.");
      setPhase("awaiting_autosync");
      return;
    }

    await refreshIntegrations();
    await sleep(700);
    setPhase("building");

    try {
      const snap = await postJson<JobSnapshot>(`/api/v1/studio/jobs/${id}`, {
        enableAutosync: true,
      });
      setJob(snap);
      jobIdRef.current = snap.id;

      if (snap.status === "needs_permission") {
        applyPausedUi(snap);
        setError(
          snap.permission?.message ||
            "Approve every Google permission checkbox, then click Enable auto-sync again."
        );
        return;
      }
      if (snap.status === "running") {
        await advanceUntilPaused(id, snap);
      } else if (snap.status === "ready") {
        setPhase("ready");
      } else if (snap.status === "awaiting_autosync") {
        setPhase("awaiting_autosync");
      } else if (snap.status === "failed") {
        setPhase("idle");
        setError(snap.error || "Could not enable auto-sync");
      } else {
        await advanceUntilPaused(id, snap);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable auto-sync");
      setPhase("awaiting_autosync");
    } finally {
      setEnablingAutosync(false);
    }
  }, [
    advanceUntilPaused,
    applyPausedUi,
    integrationStatus.gmail.reconnectUrl,
    job?.id,
    job?.permission?.reconnectUrl,
    job?.sheet?.id,
    refreshIntegrations,
  ]);

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
  const awaitingAutosync =
    job?.status === "awaiting_autosync" || phase === "awaiting_autosync";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Ask AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We create your sheet with data, then Enable auto-sync asks Google for
          permission in this app — syncing runs every minute with no sheet
          steps.
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
          disabled={
            phase === "building" ||
            enablingAutosync ||
            prompt.trim().length < 8
          }
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
              Live build
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

            {job.permission?.message && phase === "permissions" && (
              <div className="mt-3 space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  {job.permission.message}
                </p>
                <button
                  type="button"
                  onClick={() => void resumeAfterPermission()}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
                >
                  I’ve connected Google — continue
                </button>
              </div>
            )}

            {awaitingAutosync && (
              <div className="mt-4 space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Sheet is ready — enable auto-sync here
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click below. A Google popup asks for Gmail + Sheets access.
                    After you approve, InboxFlow syncs starred mail into your
                    sheet every {job.plan.syncMinutes} minute
                    {job.plan.syncMinutes === 1 ? "" : "s"}. You never need the
                    sheet menu.
                  </p>
                </div>
                {job.sheet?.spreadsheetUrl && (
                  <a
                    href={job.sheet.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-xs font-medium text-emerald-700 underline dark:text-emerald-300"
                  >
                    {job.sheet.spreadsheetUrl}
                  </a>
                )}
                <button
                  type="button"
                  disabled={enablingAutosync}
                  onClick={() => void openGoogleThenEnableAutosync()}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {enablingAutosync
                    ? "Authorizing & enabling…"
                    : "Enable auto-sync"}
                </button>
              </div>
            )}
          </div>

          <StudioTaskProgress
            tasks={job.tasks}
            progressPercent={job.progress?.percent}
          />
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
                Auto-sync runs from InboxFlow every{" "}
                {job.sheet.syncMinutes ?? job.plan.syncMinutes} min (Groq AI). Keep
                the app running — no Google Sheet menu steps.
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
        onConnected={() => void resumeAfterPermission()}
        onCancel={() => setCredentialModal(null)}
      />
    </div>
  );
}
