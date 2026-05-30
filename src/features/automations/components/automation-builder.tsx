"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { GmailTriggerConfig } from "./gmail-trigger-config";
import { nodeTypes } from "./custom-nodes";
import { NodePalette } from "./node-palette";
import {
  ACTION_DEFINITIONS,
  TRIGGER_DEFINITIONS,
  type NodeDefinition,
} from "@/lib/automation/definitions";
import { automationClient } from "@/services/automation-client";
import type { WorkflowGraph, WorkflowNodeData } from "@/types/automation";

type AutomationRecord = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  triggerType: string;
  graph: WorkflowGraph;
  runCount: number;
  lastRunAt: string | null;
};

type Props = {
  organizationId: string;
  automationId?: string;
};

function defToNode(def: NodeDefinition, position: { x: number; y: number }): Node {
  return {
    id: `${def.kind}-${Date.now()}`,
    type: def.type,
    position,
    data: {
      kind: def.kind,
      label: def.label,
      config: { ...def.defaultConfig },
    } satisfies WorkflowNodeData,
  };
}

function graphToFlow(graph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
    })),
  };
}

function flowToGraph(nodes: Node[], edges: Edge[]): WorkflowGraph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as "trigger" | "action",
      position: n.position,
      data: n.data as WorkflowNodeData,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
    })),
  };
}

export function AutomationBuilder({ organizationId, automationId }: Props) {
  const router = useRouter();
  const [name, setName] = useState("New Automation");
  const [status, setStatus] = useState("DRAFT");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [executions, setExecutions] = useState<unknown[]>([]);
  const [id, setId] = useState(automationId);

  const initial = useMemo(() => {
    const trigger = TRIGGER_DEFINITIONS[0];
    const action = ACTION_DEFINITIONS[0];
    return graphToFlow({
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 80, y: 200 },
          data: {
            kind: trigger.kind,
            label: trigger.label,
            config: { ...trigger.defaultConfig },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 380, y: 200 },
          data: {
            kind: action.kind,
            label: action.label,
            config: { ...action.defaultConfig },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "trigger-1",
          target: "action-1",
        },
      ],
    });
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge({ ...connection, id: `e-${Date.now()}` }, eds)
      ),
    [setEdges]
  );

  const loadAutomation = useCallback(async () => {
    if (!automationId) return;
    const { item } = await automationClient.get(automationId);
    const a = item as AutomationRecord;
    setId(a.id);
    setName(a.name);
    setStatus(a.status);
    const flow = graphToFlow(a.graph);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    const { items } = await automationClient.executions(automationId);
    setExecutions(items);
  }, [automationId, setNodes, setEdges]);

  useEffect(() => {
    loadAutomation().catch(console.error);
  }, [loadAutomation]);

  const onAddNode = (def: NodeDefinition) => {
    const triggerCount = nodes.filter((n) => n.type === "trigger").length;
    if (def.type === "trigger" && triggerCount >= 1) {
      setMessage("Only one trigger allowed");
      return;
    }
    setNodes((nds) => [
      ...nds,
      defToNode(def, { x: 120 + nds.length * 40, y: 120 + nds.length * 60 }),
    ]);
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/reactflow");
      if (!raw) return;
      const def = JSON.parse(raw) as NodeDefinition;
      const bounds = (event.target as HTMLElement)
        .closest(".react-flow")
        ?.getBoundingClientRect();
      const position = {
        x: event.clientX - (bounds?.left ?? 0) - 100,
        y: event.clientY - (bounds?.top ?? 0) - 40,
      };
      onAddNode(def);
    },
    [onAddNode]
  );

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const graph = flowToGraph(nodes, edges);
      const triggerNode = graph.nodes.find((n) => n.type === "trigger");
      if (!triggerNode) throw new Error("Add a trigger node");

      if (id) {
        await automationClient.update(id, { name, graph });
      } else {
        const { item } = await automationClient.create({
          organizationId,
          name,
          triggerType: triggerNode.data.kind,
          graph,
          cronExpression:
            triggerNode.data.kind === "SCHEDULED_TIME"
              ? String(triggerNode.data.config.cronExpression ?? "0 9 * * *")
              : undefined,
        });
        setId(item.id);
        window.history.replaceState(null, "", `/automations/${item.id}`);
      }
      setMessage("Saved");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    let activeId = id;
    if (!activeId) {
      setSaving(true);
      try {
        const graph = flowToGraph(nodes, edges);
        const triggerNode = graph.nodes.find((n) => n.type === "trigger");
        if (!triggerNode) throw new Error("Add a trigger node");
        const { item } = await automationClient.create({
          organizationId,
          name,
          triggerType: triggerNode.data.kind,
          graph,
        });
        activeId = item.id;
        setId(item.id);
      } finally {
        setSaving(false);
      }
    } else {
      await automationClient.update(activeId, { name, graph: flowToGraph(nodes, edges) });
    }
    await automationClient.activate(activeId!);
    setStatus("ACTIVE");
    setMessage("Automation activated");
  };

  const deleteWorkflow = async () => {
    if (!id) return;
    if (
      !confirm(
        `Delete "${name}"? This cannot be undone. All run history will be removed.`
      )
    ) {
      return;
    }
    try {
      await automationClient.delete(id);
      router.push("/automations");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const testRun = async () => {
    if (!id) {
      setMessage("Save first");
      return;
    }
    setRunning(true);
    try {
      const { executionId } = await automationClient.execute(id);
      setMessage(`Test run started: ${executionId}`);
      const { items } = await automationClient.executions(id);
      setExecutions(items);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const updateSelectedConfig = (key: string, value: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNode.id) return n;
        const data = n.data as WorkflowNodeData;
        return {
          ...n,
          data: {
            ...data,
            config: { ...data.config, [key]: value },
          },
        };
      })
    );
  };

  const replaceSelectedConfig = (config: WorkflowNodeData["config"]) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNode.id) return n;
        const data = n.data as WorkflowNodeData;
        return { ...n, data: { ...data, config } };
      })
    );
    setSelectedNode((prev) =>
      prev
        ? {
            ...prev,
            data: {
              ...(prev.data as WorkflowNodeData),
              config,
            },
          }
        : null
    );
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-transparent text-lg font-semibold outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{status}</span>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={activate}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Activate
          </button>
          <button
            type="button"
            onClick={testRun}
            disabled={running}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {running ? "Running…" : "Test run"}
          </button>
          {id && (
            <button
              type="button"
              onClick={deleteWorkflow}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {message && (
        <p className="border-b border-border bg-muted px-4 py-1 text-xs">{message}</p>
      )}
      <div className="flex flex-1 min-h-0">
        <NodePalette
          triggers={TRIGGER_DEFINITIONS}
          actions={ACTION_DEFINITIONS}
          onAdd={onAddNode}
        />
        <div className="flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNode(node)}
            fitView
            className="bg-muted/30"
          >
            <Background />
            <Controls />
            <MiniMap />
            <Panel position="top-left" className="rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground">
              Drag nodes from palette • Connect trigger → actions
            </Panel>
          </ReactFlow>
        </div>
        <aside className="w-64 shrink-0 border-l border-border p-3 overflow-y-auto">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Node config
          </p>
          {selectedNode ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm font-medium">
                {(selectedNode.data as WorkflowNodeData).label}
              </p>
              {(selectedNode.data as WorkflowNodeData).kind ===
              "NEW_GMAIL_EMAIL" ? (
                <GmailTriggerConfig
                  config={(selectedNode.data as WorkflowNodeData).config}
                  onChange={replaceSelectedConfig}
                />
              ) : (
                Object.entries(
                  (selectedNode.data as WorkflowNodeData).config
                ).map(([key, val]) => (
                  <label key={key} className="block text-xs">
                    <span className="text-muted-foreground">{key}</span>
                    <input
                      className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                      value={
                        typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val ?? "")
                      }
                      onChange={(e) =>
                        updateSelectedConfig(key, e.target.value)
                      }
                    />
                  </label>
                ))
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Select a node to edit config. Use {"{{trigger.body}}"} templates.
            </p>
          )}
          <p className="mt-6 text-xs font-semibold uppercase text-muted-foreground">
            Recent runs
          </p>
          <ul className="mt-1 space-y-1">
            {(executions as Array<{ id: string; status: string; startedAt: string }>)
              .slice(0, 5)
              .map((ex) => (
                <li key={ex.id} className="text-[10px] text-muted-foreground">
                  {ex.status} · {new Date(ex.startedAt).toLocaleString()}
                </li>
              ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
