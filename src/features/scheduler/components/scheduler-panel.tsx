"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type SchedulerData = {
  scheduled: Array<{
    id: string;
    name: string;
    status: string;
    cronExpression: string | null;
    timezone: string | null;
    lastRunAt: string | null;
    runCount: number;
    lastError: string | null;
  }>;
  outboundJobs: Array<{
    id: string;
    type: string;
    status: string;
    recipientPhone: string;
    createdAt: string;
    lastError: string | null;
  }>;
  pendingExecutions: Array<{
    id: string;
    status: string;
    startedAt: string;
    errorMessage: string | null;
    automation: { name: string };
  }>;
};

export function SchedulerPanel() {
  const [data, setData] = useState<SchedulerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/scheduler");
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading scheduler…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scheduler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cron-based automations, outbound WhatsApp jobs, and paused executions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Scheduled automations</h2>
          <Link href="/automations" className="text-xs underline text-muted-foreground">
            Manage
          </Link>
        </div>
        <ul className="space-y-2">
          {(data?.scheduled ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-1 rounded-lg border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  href={`/automations/${a.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {a.name}
                </Link>
                <p className="text-[11px] text-muted-foreground">
                  <code>{a.cronExpression || "—"}</code> · {a.timezone || "UTC"} ·{" "}
                  {a.status}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {a.runCount} runs
                {a.lastRunAt
                  ? ` · last ${new Date(a.lastRunAt).toLocaleString()}`
                  : ""}
              </p>
            </li>
          ))}
          {(data?.scheduled.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              No schedule triggers yet. Add an <strong>On schedule</strong> node in Automations.
            </p>
          )}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-4">
          <h2 className="mb-3 text-sm font-semibold">WhatsApp outbound queue</h2>
          <ul className="space-y-2">
            {(data?.outboundJobs ?? []).slice(0, 12).map((j) => (
              <li key={j.id} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{j.type}</span>
                  <span className="text-xs text-muted-foreground">{j.status}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  to {j.recipientPhone} · {new Date(j.createdAt).toLocaleString()}
                </p>
                {j.lastError && (
                  <p className="mt-1 text-xs text-amber-700">{j.lastError}</p>
                )}
              </li>
            ))}
            {(data?.outboundJobs.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Queue is empty.</p>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-border p-4">
          <h2 className="mb-3 text-sm font-semibold">Waiting / retrying runs</h2>
          <ul className="space-y-2">
            {(data?.pendingExecutions ?? []).map((e) => (
              <li key={e.id} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{e.automation.name}</span>
                  <span className="text-xs">{e.status}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(e.startedAt).toLocaleString()}
                </p>
                {e.errorMessage && (
                  <p className="mt-1 text-xs text-muted-foreground">{e.errorMessage}</p>
                )}
              </li>
            ))}
            {(data?.pendingExecutions.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Nothing waiting.</p>
            )}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Approvals are managed in{" "}
            <Link href="/agent-lab" className="underline">
              Agent Lab
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
