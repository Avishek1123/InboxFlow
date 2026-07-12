"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = "overview" | "chat" | "generate" | "approvals" | "tools";

type ObservabilityData = {
  summary: {
    executions24h: number;
    agentRuns24h: number;
    toolCallsRecent: number;
    successRate24h: number;
    failed24h: number;
    pendingApprovals: number;
    waitingApprovals: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    estimatedCostLabel: string;
    toolsAvailable: number;
  };
  executions: Array<{
    id: string;
    status: string;
    startedAt: string;
    errorMessage?: string | null;
    automation: { id: string; name: string };
    steps: Array<{
      id: string;
      label: string | null;
      nodeType: string;
      status: string;
      latencyMs: number | null;
      errorMessage?: string | null;
    }>;
  }>;
  agentRuns: Array<{
    id: string;
    goal: string;
    status: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    startedAt: string;
    toolCalls: Array<{
      id: string;
      toolName: string;
      status: string;
      latencyMs: number | null;
    }>;
  }>;
  usage: Array<{
    id: string;
    day: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    requestCount: number;
  }>;
  tools: Array<{
    name: string;
    description: string;
    sideEffect: string;
    requiresApproval: boolean;
  }>;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "Request failed");
  return json.data as T;
}

export function AgentLabPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<ObservabilityData>("/api/v1/agent/observability");
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: Array<{ id: Tab; label: string }> = useMemo(
    () => [
      { id: "overview", label: "Observability" },
      { id: "chat", label: "Workspace chat" },
      { id: "generate", label: "Generate workflow" },
      {
        id: "approvals",
        label: data?.summary.pendingApprovals
          ? `Approvals (${data.summary.pendingApprovals})`
          : "Approvals",
      },
      { id: "tools", label: "Tools" },
    ],
    [data?.summary.pendingApprovals]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent Lab</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Build AI agents on top of your inbox, tables, and sheets — monitor
            runs, chat with your workspace, generate workflows, and approve
            sensitive actions.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              tab === t.id
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {tab === "overview" && (
        <OverviewTab data={data} loading={loading} />
      )}
      {tab === "chat" && <ChatTab />}
      {tab === "generate" && <GenerateTab />}
      {tab === "approvals" && <ApprovalsTab onChanged={load} />}
      {tab === "tools" && <ToolsTab tools={data?.tools ?? []} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OverviewTab({
  data,
  loading,
}: {
  data: ObservabilityData | null;
  loading: boolean;
}) {
  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading observability…</p>;
  }
  if (!data) return null;
  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Runs (24h)" value={s.executions24h} hint={`${s.successRate24h}% success`} />
        <StatCard label="Agent runs" value={s.agentRuns24h} hint={`${s.toolCallsRecent} tool calls`} />
        <StatCard
          label="AI cost (tracked)"
          value={s.estimatedCostLabel}
          hint={`${(s.inputTokens + s.outputTokens).toLocaleString()} tokens`}
        />
        <StatCard
          label="Needs attention"
          value={s.pendingApprovals + s.waitingApprovals + s.failed24h}
          hint={`${s.pendingApprovals} approvals · ${s.failed24h} failed`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent workflow runs</h2>
            <Link href="/automations" className="text-xs text-muted-foreground underline">
              Open automations
            </Link>
          </div>
          <ul className="space-y-2">
            {data.executions.slice(0, 8).map((ex) => (
              <li
                key={ex.id}
                className="rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{ex.automation.name}</span>
                  <StatusPill status={ex.status} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(ex.startedAt).toLocaleString()} · {ex.steps.length} steps
                </p>
                {ex.errorMessage && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    {ex.errorMessage}
                  </p>
                )}
              </li>
            ))}
            {data.executions.length === 0 && (
              <p className="text-sm text-muted-foreground">No runs in the last 24 hours.</p>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-border p-4">
          <h2 className="mb-3 text-sm font-semibold">Agent runs & tool calls</h2>
          <ul className="space-y-2">
            {data.agentRuns.slice(0, 8).map((run) => (
              <li
                key={run.id}
                className="rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="line-clamp-1 font-medium">{run.goal}</span>
                  <StatusPill status={run.status} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {run.toolCalls.length} tools · {run.inputTokens + run.outputTokens} tokens · $
                  {run.estimatedCostUsd.toFixed(4)}
                </p>
                {run.toolCalls.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {run.toolCalls.map((t) => t.toolName).join(" → ")}
                  </p>
                )}
              </li>
            ))}
            {data.agentRuns.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No agent runs yet. Add an <strong>AI Agent</strong> node to a workflow.
              </p>
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-border p-4">
        <h2 className="mb-3 text-sm font-semibold">Daily AI usage</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Day</th>
                <th className="pb-2 font-medium">Provider</th>
                <th className="pb-2 font-medium">Model</th>
                <th className="pb-2 font-medium">Requests</th>
                <th className="pb-2 font-medium">Tokens</th>
                <th className="pb-2 font-medium">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {data.usage.map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="py-2">{new Date(u.day).toLocaleDateString()}</td>
                  <td className="py-2">{u.provider}</td>
                  <td className="py-2 font-mono text-xs">{u.model}</td>
                  <td className="py-2">{u.requestCount}</td>
                  <td className="py-2">
                    {(u.inputTokens + u.outputTokens).toLocaleString()}
                  </td>
                  <td className="py-2">${u.estimatedCostUsd.toFixed(4)}</td>
                </tr>
              ))}
              {data.usage.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-muted-foreground">
                    Usage appears after agent/chat/generate calls.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "COMPLETED" || status === "APPROVED"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : status === "FAILED" || status === "REJECTED" || status === "CANCELLED"
        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
        : status === "WAITING_APPROVAL" || status === "PENDING"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", tone)}>
      {status}
    </span>
  );
}

function ChatTab() {
  const [threadId, setThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<
    Array<{ id: string; role: string; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    const text = input.trim();
    setInput("");
    try {
      const res = await api<{
        thread: { id: string };
        messages: Array<{ id: string; role: string; content: string }>;
      }>("/api/v1/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, threadId }),
      });
      setThreadId(res.thread.id);
      setMessages(res.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex min-h-[480px] flex-col rounded-xl border border-border bg-background">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Chat with your workspace</h2>
          <p className="text-xs text-muted-foreground">
            Ask about inbox messages, data tables, and workflow runs. Send tools are blocked here.
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Try: “What were the latest WhatsApp messages?” or “Show rows in my leads table.”
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "ml-auto bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-muted"
              )}
            >
              {m.content}
            </div>
          ))}
        </div>
        {error && (
          <p className="px-4 text-xs text-red-600">{error}</p>
        )}
        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask your workspace…"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void send()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>
      <aside className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        <h3 className="font-semibold text-foreground">What chat can do</h3>
        <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed">
          <li>Search recent inbox messages</li>
          <li>Query extraction tables</li>
          <li>Explain recent automation failures</li>
          <li>Use read/write tools (not send)</li>
        </ul>
        <p className="mt-4 text-xs">
          For autonomous sending, use an <strong>AI Agent</strong> node with approval.
        </p>
      </aside>
    </div>
  );
}

function GenerateTab() {
  const [prompt, setPrompt] = useState(
    "When a starred Gmail arrives, run an AI agent to extract lead fields into my table, sync the Google Sheet, then ask for approval before WhatsApping the sender."
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    draft: {
      name: string;
      description: string;
      triggerType: string;
      validation: { valid: boolean; errors: string[] };
      graph: { nodes: unknown[]; edges: unknown[] };
    };
    automation: { id: string; name: string } | null;
  } | null>(null);

  async function generate(save: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{
        draft: {
          name: string;
          description: string;
          triggerType: string;
          validation: { valid: boolean; errors: string[] };
          graph: { nodes: unknown[]; edges: unknown[] };
        };
        automation: { id: string; name: string } | null;
      }>("/api/v1/agent/generate-workflow", {
        method: "POST",
        body: JSON.stringify({ prompt, save }),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Describe the workflow</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          AI drafts a React Flow graph using your available triggers, actions, and agent nodes.
        </p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="mt-3 min-h-[180px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void generate(false)}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            {busy ? "Generating…" : "Preview draft"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void generate(true)}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Generate & save draft
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold">Result</h2>
        {!result && (
          <p className="mt-3 text-sm text-muted-foreground">
            Draft details appear here after generation.
          </p>
        )}
        {result && (
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="font-medium">{result.draft.name}</p>
              <p className="text-xs text-muted-foreground">{result.draft.description}</p>
            </div>
            <p className="text-xs">
              Trigger: <code className="rounded bg-muted px-1">{result.draft.triggerType}</code>
            </p>
            <p className="text-xs">
              Nodes: {result.draft.graph.nodes.length} · Edges:{" "}
              {result.draft.graph.edges.length}
            </p>
            <div>
              <StatusPill
                status={result.draft.validation.valid ? "COMPLETED" : "FAILED"}
              />
              {!result.draft.validation.valid && (
                <ul className="mt-2 list-disc pl-4 text-xs text-amber-700 dark:text-amber-300">
                  {result.draft.validation.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
            {result.automation && (
              <Link
                href={`/automations/${result.automation.id}`}
                className="inline-flex rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Open in builder →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalsTab({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<
    Array<{
      id: string;
      status: string;
      summary: string;
      createdAt: string;
      decidedNote?: string | null;
    }>
  >([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ items: typeof items }>("/api/v1/agent/approvals");
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approvals");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    setBusyId(id);
    setError(null);
    try {
      await api("/api/v1/agent/approvals", {
        method: "POST",
        body: JSON.stringify({ id, decision, resume: true }),
      });
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Human-in-the-loop gates from <strong>Ask for approval</strong> nodes.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <StatusPill status={item.status} />
                <span className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium">{item.summary}</p>
            </div>
            {item.status === "PENDING" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item.id, "REJECTED")}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item.id, "APPROVED")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Approve & continue
                </button>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No approval requests yet.
          </p>
        )}
      </ul>
    </div>
  );
}

function ToolsTab({
  tools,
}: {
  tools: Array<{
    name: string;
    description: string;
    sideEffect: string;
    requiresApproval: boolean;
  }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((t) => (
        <div key={t.name} className="rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-2">
            <code className="text-xs font-semibold text-violet-700 dark:text-violet-300">
              {t.name}
            </code>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide">
              {t.sideEffect}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
          {t.requiresApproval && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
              Recommended behind approval
            </p>
          )}
        </div>
      ))}
      {tools.length === 0 && (
        <p className="text-sm text-muted-foreground">No tools registered.</p>
      )}
    </div>
  );
}
