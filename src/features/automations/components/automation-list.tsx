"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Active" value={stats.activeAutomations} />
          <StatCard label="Total" value={stats.totalAutomations} />
          <StatCard label="Runs (24h)" value={stats.executions24h} />
          <StatCard
            label="Success rate"
            value={`${Math.round(stats.successRate24h * 100)}%`}
          />
        </div>
      )}

      <div className="flex justify-between">
        <h2 className="text-sm font-medium">Your workflows</h2>
        <button
          type="button"
          onClick={createNew}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          New automation
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No automations yet. Create your first Zapier-style workflow.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 px-4 py-3 hover:bg-muted/50"
            >
              <Link
                href={`/automations/${a.id}`}
                className="min-w-0 flex-1"
              >
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.triggerType.replace(/_/g, " ").toLowerCase()} · {a.runCount}{" "}
                  runs
                </p>
              </Link>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  a.status === "ACTIVE"
                    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {a.status}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(a.id, a.name)}
                disabled={deletingId === a.id}
                className="shrink-0 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
              >
                {deletingId === a.id ? "…" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
