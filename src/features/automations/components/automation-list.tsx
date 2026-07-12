"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { automationClient } from "@/services/automation-client";
import type { MonitoringStats } from "@/types/automation";

type AutomationItem = {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  runCount: number;
  lastRunAt: string | null;
};

type Props = {
  organizationId: string;
};

export function AutomationList({ organizationId }: Props) {
  const [items, setItems] = useState<AutomationItem[]>([]);
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      automationClient.list(organizationId),
      automationClient.monitoring(organizationId),
    ])
      .then(([list, mon]) => {
        setItems(list.items as AutomationItem[]);
        setStats(mon.stats as MonitoringStats);
      })
      .finally(() => setLoading(false));
  }, [organizationId]);

  const createNew = async () => {
    const trigger = "NEW_GMAIL_EMAIL";
    const { item } = await automationClient.create({
      organizationId,
      name: "Untitled workflow",
      triggerType: trigger,
      graph: {
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 80, y: 200 },
            data: {
              kind: trigger,
              label: "New Gmail Email",
              config: {},
            },
          },
          {
            id: "action-1",
            type: "action",
            position: { x: 400, y: 200 },
            data: {
              kind: "STORE_DATA",
              label: "Store Data",
              config: { key: "inbox_event", valueTemplate: "{{trigger}}" },
            },
          },
        ],
        edges: [{ id: "e1", source: "trigger-1", target: "action-1" }],
      },
    });
    window.location.href = `/automations/${item.id}`;
  };

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `Delete "${name}"? This cannot be undone. All run history for this workflow will be removed.`
      )
    ) {
      return;
    }
    setDeletingId(id);
    try {
      await automationClient.delete(id);
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading workflows…</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Workflows"
        description="Your automations. Prefer Ask AI to build from a prompt — or open a flow to edit and test."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/create"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Ask AI
            </Link>
            <button
              type="button"
              onClick={createNew}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Blank workflow
            </button>
          </div>
        }
      />

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active" value={stats.activeAutomations} />
          <StatCard label="Total workflows" value={stats.totalAutomations} />
          <StatCard label="Runs (24h)" value={stats.executions24h} />
          <StatCard
            label="Success rate"
            value={`${Math.round(stats.successRate24h * 100)}%`}
          />
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium">No workflows yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first automation — connect Gmail or WhatsApp when you add
            those steps.
          </p>
          <button
            type="button"
            onClick={createNew}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Create workflow
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((a) => (
            <article
              key={a.id}
              className="flex flex-col rounded-2xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/automations/${a.id}`} className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{a.name}</h3>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {a.triggerType.replace(/_/g, " ").toLowerCase()}
                  </p>
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    a.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.status}
                </span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {a.runCount} runs
                {a.lastRunAt
                  ? ` · last ${new Date(a.lastRunAt).toLocaleDateString()}`
                  : ""}
              </p>
              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                <Link
                  href={`/automations/${a.id}`}
                  className="flex-1 rounded-lg border border-border py-2 text-center text-sm font-medium hover:bg-muted"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.name)}
                  disabled={deletingId === a.id}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                >
                  {deletingId === a.id ? "…" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
