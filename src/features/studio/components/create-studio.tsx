"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { StudioCinematicBuild } from "@/features/studio/components/studio-cinematic-build";

type LaunchReady = {
  status: "ready";
  draft: {
    name: string;
    description: string;
    triggerType: string;
    validation: { valid: boolean; errors: string[] };
    nodeCount: number;
    sheetSyncMinutes?: number;
  };
  sheet: {
    id: string;
    spreadsheetUrl: string | null;
    sheetTitle: string;
    extractionTableId: string;
    extractionTableName: string;
    needsGooglePermissions?: boolean;
    reconnectUrl?: string;
    setupNote?: string;
    autoSyncOn?: boolean;
    syncMinutes?: number;
  } | null;
  automation: { id: string; name: string; status: string };
};

type LaunchNeedsPermissions = {
  status: "needs_permissions";
  draft: {
    name: string;
    description: string;
    triggerType: string;
    validation: { valid: boolean; errors: string[] };
    nodeCount: number;
    sheetSyncMinutes?: number;
  };
  missingIntegrations: IntegrationRequirement[];
  reconnectUrl: string;
  sheet: null;
  automation: null;
};

type LaunchResult = LaunchReady | LaunchNeedsPermissions;

type RunStep = {
  id: string;
  label: string | null;
  nodeType: string;
  status: string;
  errorMessage?: string | null;
};

type BuildStageKey =
  | "prompt"
  | "permissions"
  | "sheet"
  | "autosync"
  | "ready";

const EXAMPLES = [
  "When I star a Gmail, extract the lead into a Google Sheet named Lead Tracker.",
  "When a WhatsApp message arrives, save a summary to a Google Sheet.",
  "On new Twilio SMS, extract the customer request into a Google Sheet.",
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

async function launchStudio(
  prompt: string,
  syncIntervalMinutes?: number
): Promise<LaunchResult> {
  const res = await fetch("/api/v1/studio/launch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      activate: true,
      ...(syncIntervalMinutes != null ? { syncIntervalMinutes } : {}),
    }),
  });
  const text = await res.text();
  let json: { error?: { message?: string }; data?: LaunchResult };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    if (res.status === 504 || /gateway|timed out|timeout/i.test(text)) {
      throw new Error(
        "Build timed out. Try again — if it keeps happening, reconnect Gmail and use a shorter prompt."
      );
    }
    throw new Error(
      res.status >= 500
        ? `Server error (${res.status}). Try again in a moment.`
        : "Launch failed with an unexpected response."
    );
  }
  if (json.error) throw new Error(json.error.message || "Launch failed");
  if (!json.data) throw new Error("Launch failed");
  return json.data;
}

export function CreateStudio() {
  const [prompt, setPrompt] = useState(EXAMPLES[0]!);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(1);
  const [phase, setPhase] = useState<
    "idle" | "building" | "permissions" | "ready" | "testing"
  >("idle");
  const [buildStage, setBuildStage] = useState<BuildStageKey>("prompt");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);
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
  const [cinematicOpen, setCinematicOpen] = useState(false);
  const [cinematicFinishing, setCinematicFinishing] = useState(false);
  const pendingReadyRef = useRef<LaunchReady | null>(null);

  const asksForAutoUpdate = useMemo(
    () => promptRequestsSheetAutoUpdate(prompt),
    [prompt]
  );

  useEffect(() => {
    if (!asksForAutoUpdate) return;
    const fromPrompt = parseSheetSyncMinutesFromPrompt(prompt);
    if (fromPrompt != null) setSyncIntervalMinutes(fromPrompt);
  }, [prompt, asksForAutoUpdate]);

  const build = useCallback(async () => {
    setPhase("building");
    setBuildStage("prompt");
    setError(null);
    setTestSteps([]);
    setTestStatus(null);
    setTestError(null);
    setResult(null);
    pendingReadyRef.current = null;
    setCinematicFinishing(false);
    setCinematicOpen(true);

    const timers = [
      window.setTimeout(() => setBuildStage("permissions"), 900),
      window.setTimeout(() => setBuildStage("sheet"), 2200),
      window.setTimeout(() => setBuildStage("autosync"), 4000),
    ];

    try {
      const data = await launchStudio(
        prompt.trim(),
        asksForAutoUpdate ? syncIntervalMinutes : undefined
      );
      timers.forEach(clearTimeout);

      if (data.status === "needs_permissions") {
        setCinematicOpen(false);
        setCinematicFinishing(false);
        setResult(data);
        setBuildStage("permissions");
        setPhase("permissions");
        setCredentialModal(data.missingIntegrations[0] ?? "GMAIL");
        return;
      }

      setBuildStage("ready");
      pendingReadyRef.current = data;
      setCinematicFinishing(true);
    } catch (e) {
      timers.forEach(clearTimeout);
      setCinematicOpen(false);
      setCinematicFinishing(false);
      pendingReadyRef.current = null;
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("idle");
      setBuildStage("prompt");
    }
  }, [prompt, syncIntervalMinutes, asksForAutoUpdate]);

  const finishCinematic = useCallback(() => {
    const data = pendingReadyRef.current;
    if (!data) {
      setCinematicOpen(false);
      setCinematicFinishing(false);
      return;
    }
    pendingReadyRef.current = null;
    setResult(data);
    setCinematicOpen(false);
    setCinematicFinishing(false);
    setBuildStage("ready");
    setPhase("ready");

    if (data.sheet?.needsGooglePermissions && data.sheet.reconnectUrl) {
      setSheetPermission({
        exportId: data.sheet.id,
        reconnectUrl: data.sheet.reconnectUrl,
      });
    }
  }, []);

  const resumeAfterConnect = useCallback(async () => {
    setCredentialModal(null);
    setBuildStage("sheet");
    await refreshIntegrations();
    await build();
  }, [build, refreshIntegrations]);

  async function runTest() {
    if (!result || result.status !== "ready") return;
    setPhase("testing");
    setTestError(null);
    setTestStatus("Starting test run…");
    setTestSteps([]);
    try {
      const { executionId } = await automationClient.execute(result.automation.id, {
        source: "studio_test",
        body: "Studio test run",
      });
      setTestStatus(`Run ${executionId.slice(0, 8)}…`);

      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const { items } = await automationClient.executions(result.automation.id);
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
          id: string;
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
          row.status === "WAITING_APPROVAL"
        ) {
          break;
        }
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Test failed");
      setTestStatus("FAILED");
    } finally {
      setPhase("ready");
    }
  }

  useEffect(() => {
    if (phase !== "permissions" || !result || result.status !== "needs_permissions") {
      return;
    }
    const missing = result.missingIntegrations;
    const gmailOk =
      integrationStatus.gmail.connected &&
      !integrationStatus.gmail.needsReconnect;
    const stillMissing = missing.filter((m) => {
      if (m === "GMAIL") return !gmailOk;
      if (m === "WHATSAPP") return !integrationStatus.whatsapp.connected;
      if (m === "TWILIO") return !integrationStatus.twilio.connected;
      return true;
    });
    if (stillMissing.length === 0) {
      void build();
    }
  }, [phase, result, integrationStatus, build]);

  const ready = result?.status === "ready" ? result : null;
  const needsPerms =
    result?.status === "needs_permissions" ? result : null;

  return (
    <>
      <StudioCinematicBuild
        open={cinematicOpen}
        stage={buildStage}
        promptSnippet={prompt}
        finishing={cinematicFinishing}
        onComplete={finishCinematic}
      />
      <IntegrationCredentialModal
        open={credentialModal !== null}
        integration={credentialModal ?? "GMAIL"}
        node={null}
        gmailReconnectUrl={
          needsPerms?.reconnectUrl ||
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
          onDone={(message) => {
            setSheetPermission(null);
            setError(null);
            setResult((prev) =>
              prev && prev.status === "ready"
                ? {
                    ...prev,
                    sheet: prev.sheet
                      ? {
                          ...prev.sheet,
                          needsGooglePermissions: false,
                          autoSyncOn: true,
                          setupNote: message,
                        }
                      : prev.sheet,
                  }
                : prev
            );
          }}
          onCancel={() => setSheetPermission(null)}
        />
      )}

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="space-y-2 text-center md:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Ask AI
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Describe what you want. Get a ready product.
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Permission → sheet → ready link. Mention auto-update or sync in your
            prompt only if you want to choose how often the sheet refreshes.
          </p>
        </header>

        <section
          className={cn(
            "rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-500 md:p-6",
            cinematicOpen && "pointer-events-none scale-[0.99] opacity-40"
          )}
        >
          <label className="block text-sm font-medium">Your prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            disabled={phase === "building"}
            className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none ring-offset-background focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            placeholder="e.g. Star a Gmail → put leads in a Google Sheet named Lead Tracker…"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={phase === "building"}
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {ex.slice(0, 48)}…
              </button>
            ))}
          </div>

          {asksForAutoUpdate && (
            <div className="mt-5">
              <label className="block text-sm font-medium">
                How often should the sheet auto-update?
              </label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                You asked for auto-update — pick the refresh interval.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SYNC_INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={phase === "building"}
                    onClick={() => setSyncIntervalMinutes(opt.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50",
                      syncIntervalMinutes === opt.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={phase === "building" || prompt.trim().length < 8}
            onClick={() => void build()}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
          >
            {phase === "building" || cinematicOpen
              ? "Building your product…"
              : "Build my product"}
          </button>
          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </p>
          )}
        </section>

        {needsPerms && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
            <h2 className="text-lg font-semibold">Permission needed</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Draft ready: <strong>{needsPerms.draft.name}</strong>. Connect once —
              that step will tick ✓ and we continue creating your sheet automatically.
            </p>
            <ul className="mt-4 space-y-2">
              {needsPerms.missingIntegrations.map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    onClick={() => setCredentialModal(m)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-left text-sm font-medium hover:bg-muted"
                  >
                    {m === "GMAIL"
                      ? "Connect Gmail + Google Sheets"
                      : m === "TWILIO"
                        ? "Connect Twilio"
                        : "Connect WhatsApp (Meta)"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ready && (
          <section className="studio-ready-reveal space-y-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Your product is ready
              </p>
              <h2 className="mt-1 text-xl font-semibold">{ready.automation.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {ready.draft.description}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {ready.automation.status}
                {ready.sheet
                  ? ready.sheet.autoSyncOn
                    ? ` · sheet sync every ${ready.sheet.syncMinutes ?? syncIntervalMinutes} min`
                    : " · sheet auto-sync needs setup"
                  : ""}
                {" · "}
                {ready.draft.nodeCount} steps
              </p>
            </div>

            {ready.sheet?.spreadsheetUrl && (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Final Google Sheet link
                </p>
                <a
                  href={ready.sheet.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block break-all text-sm font-medium text-emerald-700 underline dark:text-emerald-300"
                >
                  {ready.sheet.spreadsheetUrl}
                </a>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {ready.sheet.autoSyncOn
                    ? `Every ${ready.sheet.syncMinutes ?? syncIntervalMinutes} min, Apps Script in your sheet reads starred Gmail, structures fields with Gemini, and writes rows — InboxFlow server is not required for the timer.`
                    : asksForAutoUpdate
                      ? `Open the sheet → InboxFlow → Enable auto-sync (authorize Gmail + script). Then it runs every ${ready.sheet.syncMinutes ?? syncIntervalMinutes} min on its own.`
                      : "Your sheet is ready. Mention auto-update in a new prompt if you want a refresh schedule."}
                  {ready.sheet.setupNote ? ` ${ready.sheet.setupNote}` : ""}
                </p>
                {ready.sheet.needsGooglePermissions && (
                  <button
                    type="button"
                    onClick={() =>
                      setSheetPermission({
                        exportId: ready.sheet!.id,
                        reconnectUrl:
                          ready.sheet!.reconnectUrl ||
                          `/api/v1/integrations/gmail/connect?reconnect=1&popup=1&sheetExportId=${ready.sheet!.id}`,
                      })
                    }
                    className="mt-3 rounded-lg bg-[#0F9D58] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Finish auto-sync permission
                  </button>
                )}
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
              <Link
                href={`/automations/${ready.automation.id}`}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
              >
                Open workflow
              </Link>
              {ready.sheet?.spreadsheetUrl && (
                <a
                  href={ready.sheet.spreadsheetUrl}
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
                  Status:{" "}
                  <span className="font-semibold">{testStatus ?? "—"}</span>
                </p>
                {testError && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    {testError}
                  </p>
                )}
                {testSteps.length > 0 && (
                  <ol className="mt-3 space-y-2">
                    {testSteps.map((step, i) => (
                      <li
                        key={step.id}
                        className="flex items-start gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs"
                      >
                        <span className="font-mono text-muted-foreground">
                          {i + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {step.label || step.nodeType}
                          </p>
                          <p className="text-muted-foreground">{step.status}</p>
                          {step.errorMessage && (
                            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                              {step.errorMessage}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
