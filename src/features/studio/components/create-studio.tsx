"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IntegrationCredentialModal } from "@/features/automations/components/integration-credential-modal";
import { SheetPermissionModal } from "@/features/google-sheets/components/sheet-permission-modal";
import {
  resolveCinematicStage,
  StudioCinematicBuild,
} from "@/features/studio/components/studio-cinematic-build";
import { useIntegrationStatus } from "@/features/automations/hooks/use-integration-status";
import type { IntegrationRequirement } from "@/lib/automation/definitions";
import { automationClient } from "@/services/automation-client";
import { sheetExportClient } from "@/services/sheet-export-client";
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
    webAppUrl?: string | null;
    sheetExportId?: string;
    reason?: string;
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
  return Promise.resolve().then(
    () => new Promise<void>((r) => setTimeout(r, ms))
  );
}

export function CreateStudio() {
  const [prompt, setPrompt] = useState(EXAMPLES[0]!);
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
  const [sheetSyncBusy, setSheetSyncBusy] = useState(false);
  const [sheetSyncNote, setSheetSyncNote] = useState<string | null>(null);
  const [cinematicOpen, setCinematicOpen] = useState(false);
  const [cinematicFinishing, setCinematicFinishing] = useState(false);
  const [sheetPermission, setSheetPermission] = useState<{
    exportId: string;
    reconnectUrl: string;
    webAppUrl?: string | null;
  } | null>(null);

  const jobIdRef = useRef<string | null>(null);
  const advancingRef = useRef(false);
  const cancelledRef = useRef(false);

  const asksForAutoUpdate = useMemo(
    () => promptRequestsSheetAutoUpdate(prompt),
    [prompt]
  );

  const syncMinutes = useMemo(() => {
    const fromPrompt = parseSheetSyncMinutesFromPrompt(prompt);
    return fromPrompt ?? 1;
  }, [prompt]);

  const cinematicStage = useMemo(
    () => resolveCinematicStage(job?.tasks, job?.status ?? phase),
    [job?.tasks, job?.status, phase]
  );

  const applyPausedUi = useCallback((snap: JobSnapshot) => {
    setCredentialModal(null);
    setSheetPermission(null);
    if (snap.status === "needs_permission" && snap.permission) {
      setPhase("permissions");
      setCinematicOpen(false);
      const exportId =
        snap.permission.sheetExportId || snap.sheet?.id || null;
      const needsAppsScriptAuth =
        Boolean(exportId) &&
        (Boolean(snap.permission.webAppUrl) ||
          snap.permission.reason === "authorization" ||
          snap.permission.reason === "gcp_project" ||
          snap.permission.reason === "web_app_auth");
      if (needsAppsScriptAuth && exportId) {
        setSheetPermission({
          exportId,
          reconnectUrl: snap.permission.reconnectUrl,
          webAppUrl: snap.permission.webAppUrl,
        });
        return;
      }
      setCredentialModal(snap.permission.integration);
      return;
    }
    if (snap.status === "awaiting_autosync") {
      setPhase("awaiting_autosync");
      setCinematicOpen(true);
      setCinematicFinishing(false);
      return;
    }
  }, []);

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
          setCinematicOpen(true);
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
          setCinematicFinishing(true);
          setCinematicOpen(true);
          return;
        }
        if (snap.status === "failed") {
          setCinematicOpen(false);
          setPhase("idle");
          setError(snap.error || "Build failed");
          return;
        }
        setPhase("building");
        setCinematicOpen(true);
      } catch (e) {
        cancelledRef.current = true;
        setCinematicOpen(false);
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
    setCinematicOpen(true);
    setCinematicFinishing(false);
    setError(null);
    setTestSteps([]);
    setTestStatus(null);
    setTestError(null);
    setJob(null);
    setCredentialModal(null);
    setSheetPermission(null);
    jobIdRef.current = null;
    cancelledRef.current = true;
    await sleep(50);
    cancelledRef.current = false;

    try {
      const snap = await postJson<JobSnapshot>("/api/v1/studio/jobs", {
        prompt: prompt.trim(),
        syncIntervalMinutes: 1,
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
        setCinematicFinishing(true);
        return;
      }
      if (snap.status === "failed") {
        setCinematicOpen(false);
        setPhase("idle");
        setError(snap.error || "Build failed");
        return;
      }

      await advanceUntilPaused(snap.id, snap);
    } catch (e) {
      setCinematicOpen(false);
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("idle");
    }
  }, [prompt, advanceUntilPaused, applyPausedUi]);

  const resumeAfterPermission = useCallback(async () => {
    const id = jobIdRef.current || job?.id;
    if (!id) {
      await build();
      return;
    }
    setCredentialModal(null);
    setPhase("building");
    setCinematicOpen(true);
    setCinematicFinishing(false);
    setError(null);
    await refreshIntegrations();
    await sleep(600);

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
        if (snap.status === "ready") {
          setCinematicFinishing(true);
          setCinematicOpen(true);
          return;
        }
        await advanceUntilPaused(id, snap);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not enable auto-sync");
        setPhase("awaiting_autosync");
        setCinematicOpen(true);
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

  const openGoogleThenEnableAutosync = useCallback(async () => {
    const id = jobIdRef.current || job?.id;
    if (!id) return;

    setEnablingAutosync(true);
    setError(null);
    setCinematicOpen(true);

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
        const data = event.data as { type?: string; ok?: boolean };
        if (data?.type !== "inboxflow-gmail-oauth") return;
        done(Boolean(data.ok));
      }
      window.addEventListener("message", onMessage);

      const poll = window.setInterval(() => {
        if (popup && popup.closed) done(true);
      }, 500);

      window.setTimeout(() => done(true), 120_000);
    });

    if (!authorized) {
      setEnablingAutosync(false);
      setError("Google authorization was cancelled. Try again.");
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
        return;
      }
      if (snap.status === "ready") {
        setCinematicFinishing(true);
        setCinematicOpen(true);
      } else if (snap.status === "running") {
        await advanceUntilPaused(id, snap);
      } else if (snap.status === "awaiting_autosync") {
        setPhase("awaiting_autosync");
        setCinematicOpen(true);
      } else if (snap.status === "failed") {
        setCinematicOpen(false);
        setPhase("idle");
        setError(snap.error || "Could not enable auto-sync");
      } else {
        await advanceUntilPaused(id, snap);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable auto-sync");
      setPhase("awaiting_autosync");
      setCinematicOpen(true);
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

  const syncSheetNow = useCallback(async () => {
    const exportId = job?.sheet?.id;
    if (!exportId) return;
    setSheetSyncBusy(true);
    setSheetSyncNote("Syncing starred Gmail → sheet…");
    try {
      const result = await sheetExportClient.sync(exportId);
      setSheetSyncNote(
        `Synced ${result.rowCount} rows · fetched ${result.messagesFetched} messages · extracted ${result.extraction.succeeded}`
      );
    } catch (e) {
      setSheetSyncNote(e instanceof Error ? e.message : "Sheet sync failed");
    } finally {
      setSheetSyncBusy(false);
    }
  }, [job?.sheet?.id]);

  useEffect(() => {
    if (job?.status !== "ready" || !job.sheet?.id || !job.sheet.autoSyncOn) {
      return;
    }
    const exportId = job.sheet.id;
    const minutes = 1;
    const intervalMs = minutes * 60_000;

    let cancelled = false;
    const tick = async () => {
      if (cancelled || document.hidden) return;
      try {
        const result = await sheetExportClient.sync(exportId);
        if (!cancelled) {
          setSheetSyncNote(
            `Backup sync OK · ${result.rowCount} rows · ${new Date().toLocaleTimeString()}`
          );
        }
      } catch {
        /* Apps Script owns the live path */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [job?.status, job?.sheet?.id, job?.sheet?.autoSyncOn]);

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
        await sleep(1500);
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

  const ready = job?.status === "ready" || phase === "ready";
  const showCinematic =
    cinematicOpen &&
    (phase === "building" ||
      phase === "awaiting_autosync" ||
      cinematicFinishing);

  return (
    <div className="relative mx-auto w-full max-w-3xl space-y-6 pb-16">
      <div
        className="pointer-events-none absolute -inset-x-8 -top-10 h-64 rounded-[40px] opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 30% 0%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(20,184,166,0.1), transparent 45%)",
        }}
        aria-hidden
      />

      <header className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
          InboxFlow Studio
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Build a live product
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Prompt → sheet with your data → Apps Script sync every 1 minute.
          Permissions stay on this website — nothing to configure inside Google
          Sheets.
        </p>
      </header>

      <section className="relative space-y-3 rounded-3xl border border-border/80 bg-background/80 p-5 shadow-sm backdrop-blur">
        <label className="block text-sm font-medium">Your prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          className="w-full rounded-2xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
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
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
            Live sync locked to every{" "}
            <strong>1 minute</strong> via Google Apps Script
            {syncMinutes !== 1 ? " (prompt interval overridden for reliability)" : ""}.
          </p>
        )}

        <button
          type="button"
          disabled={
            phase === "building" ||
            enablingAutosync ||
            cinematicFinishing ||
            prompt.trim().length < 8
          }
          onClick={() => void build()}
          className="w-full rounded-2xl bg-foreground py-3.5 text-sm font-semibold text-background shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {phase === "building" || cinematicFinishing
            ? "Building product…"
            : "Build my product"}
        </button>
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
      </section>

      {job && !showCinematic && !ready && phase === "permissions" && (
        <section className="space-y-3 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="text-lg font-semibold">{job.plan.name}</h2>
          <p className="text-sm text-muted-foreground">
            {job.permission?.message ||
              "Connect Google with Gmail + Sheets access to continue."}
          </p>
          <button
            type="button"
            onClick={() => void resumeAfterPermission()}
            className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
          >
            I’ve connected Google — continue
          </button>
        </section>
      )}

      {ready && job && (
        <section className="studio-ready-reveal space-y-4 rounded-3xl border border-emerald-500/40 bg-emerald-500/5 p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
              Product ready
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {job.automation?.name || job.plan.name}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {job.automation?.status ?? "ACTIVE"} · Apps Script live · every 1
              minute
            </p>
          </div>

          {job.sheet?.spreadsheetUrl && (
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
                <li>✓ Sheet filled with your extracted data</li>
                <li>✓ Apps Script installed (website permission only)</li>
                <li>✓ Timer runs every 1 minute in Google</li>
              </ul>
              {sheetSyncNote && (
                <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-200">
                  {sheetSyncNote}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {job.sheet?.spreadsheetUrl && (
              <a
                href={job.sheet.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Open sheet
              </a>
            )}
            {job.sheet?.id && (
              <button
                type="button"
                disabled={sheetSyncBusy}
                onClick={() => void syncSheetNow()}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {sheetSyncBusy ? "Syncing…" : "Sync now"}
              </button>
            )}
            <button
              type="button"
              disabled={phase === "testing"}
              onClick={() => void runTest()}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
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
          </div>

          {(testStatus || testSteps.length > 0 || testError) && (
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Test visualization
              </p>
              <p className="mt-1 text-sm">
                Status:{" "}
                <span className="font-semibold">{testStatus ?? "—"}</span>
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

      <StudioCinematicBuild
        open={showCinematic}
        stage={cinematicStage}
        promptSnippet={prompt}
        tasks={job?.tasks}
        progressPercent={job?.progress?.percent}
        syncMinutes={1}
        finishing={cinematicFinishing}
        gate={
          phase === "awaiting_autosync" && !cinematicFinishing
            ? {
                title: "Sheet ready — activate live sync",
                subtitle:
                  "One Google approval on this website installs Apps Script and starts the 1‑minute timer. No sheet menu.",
                actionLabel: "Activate 1‑minute sync",
                busyLabel: "Authorizing with Google…",
                busy: enablingAutosync,
                onAction: () => void openGoogleThenEnableAutosync(),
              }
            : null
        }
        onComplete={() => {
          setCinematicOpen(false);
          setCinematicFinishing(false);
          setPhase("ready");
        }}
      />

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

      {sheetPermission && (
        <SheetPermissionModal
          exportId={sheetPermission.exportId}
          reconnectUrl={sheetPermission.reconnectUrl}
          webAppUrl={sheetPermission.webAppUrl}
          onDone={(result) => {
            setSheetPermission(null);
            if (result.installed) {
              setSheetSyncNote(result.message);
              setCinematicOpen(true);
              void resumeAfterPermission();
              return;
            }
            setError(result.message);
            setPhase("awaiting_autosync");
            setCinematicOpen(true);
          }}
          onCancel={() => {
            setSheetPermission(null);
            setPhase("awaiting_autosync");
            setCinematicOpen(true);
          }}
        />
      )}
    </div>
  );
}
