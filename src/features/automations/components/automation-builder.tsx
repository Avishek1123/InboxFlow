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

import { useTheme } from "@/components/providers/theme-provider";
import { IntegrationCredentialModal } from "./integration-credential-modal";
import { NodeConfigPanel } from "./node-config-panel";
import { nodeTypes } from "./custom-nodes";
import { NodePalette } from "./node-palette";
import {
  AutomationSetupPanel,
  graphNeedsGmail,
  graphNeedsSheetLink,
  isAutomationSetupReady,
} from "./automation-setup-panel";
import { useIntegrationStatus } from "@/features/automations/hooks/use-integration-status";
import type { IntegrationStatusState } from "@/features/automations/hooks/use-integration-status";
import {
  integrationLabel,
  missingIntegrationsForGraph,
  resolveStoredTriggerType,
  type PendingNodeAdd,
} from "@/lib/automation/integration-requirements";
import { resolveNodeIntegration } from "@/lib/automation/node-catalog";
import {
  CATALOG_ACTIONS,
  CATALOG_TRIGGERS,
} from "@/lib/automation/node-catalog";
import {
  type IntegrationRequirement,
  type NodeDefinition,
} from "@/lib/automation/definitions";
import { automationClient } from "@/services/automation-client";
import type { SheetExportRecord } from "@/types/sheet-export";
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
  const { resolved } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("New Automation");
  const [status, setStatus] = useState("DRAFT");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [executions, setExecutions] = useState<unknown[]>([]);
  const [id, setId] = useState(automationId);
  const { status: integrationStatus, refresh: refreshIntegrations, isConnected } =
    useIntegrationStatus();
  const [credentialModal, setCredentialModal] =
    useState<IntegrationRequirement | null>(null);
  const [pendingNode, setPendingNode] = useState<PendingNodeAdd | null>(null);
  const [linkedSheet, setLinkedSheet] = useState<SheetExportRecord | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const initial = useMemo(() => {
    const trigger =
      CATALOG_TRIGGERS.find((t) => t.kind === "MESSAGE_RECEIVED") ??
      CATALOG_TRIGGERS[0]!;
    const action =
      CATALOG_ACTIONS.find((a) => a.kind === "SEND_MESSAGE") ??
      CATALOG_ACTIONS[0]!;
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

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const ids = new Set(deleted.map((n) => n.id));
      setEdges((eds) =>
        eds.filter((e) => !ids.has(e.source) && !ids.has(e.target))
      );
      setSelectedNode((prev) => (prev && ids.has(prev.id) ? null : prev));
      if (deleted.some((n) => n.type === "trigger")) {
        setMessage("Trigger removed — add one from the palette");
      }
    },
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

  const addNodeToCanvas = useCallback(
    (def: NodeDefinition, position?: { x: number; y: number }) => {
      const triggerCount = nodes.filter((n) => n.type === "trigger").length;
      const pos =
        position ??
        (def.type === "trigger"
          ? { x: 80, y: 80 + triggerCount * 100 }
          : {
              x: 120 + nodes.length * 40,
              y: 120 + nodes.length * 60,
            });
      setNodes((nds) => [...nds, defToNode(def, pos)]);
      setMessage(null);
    },
    [nodes, setNodes]
  );

  const onAddNode = useCallback(
    (def: NodeDefinition, position?: { x: number; y: number }) => {
      const req = resolveNodeIntegration(def, def.defaultConfig);
      if (req && !isConnected(req)) {
        setPendingNode({ def, position });
        setCredentialModal(req);
        return;
      }
      addNodeToCanvas(def, position);
    },
    [addNodeToCanvas, isConnected]
  );

  const handleCredentialConnected = useCallback(async () => {
    await refreshIntegrations();
    setCredentialModal(null);
    if (pendingNode) {
      addNodeToCanvas(pendingNode.def, pendingNode.position);
      setPendingNode(null);
      setMessage(`${pendingNode.def.label} added`);
    }
  }, [addNodeToCanvas, pendingNode, refreshIntegrations]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;
    const isTrigger = selectedNode.type === "trigger";
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
    );
    setSelectedNode(null);
    setMessage(
      isTrigger
        ? "Trigger removed — pick another from the palette"
        : "Node removed"
    );
  }, [selectedNode, setNodes, setEdges]);

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
      onAddNode(def, position);
    },
    [onAddNode]
  );

  const triggerCount = nodes.filter((n) => n.type === "trigger").length;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const graph = flowToGraph(nodes, edges);
      const triggerNodes = graph.nodes.filter((n) => n.type === "trigger");
      if (triggerNodes.length === 0) throw new Error("Add at least one trigger");

      const primaryTrigger = triggerNodes[0]!;
      const storedTriggerType = resolveStoredTriggerType(
        primaryTrigger.data.kind,
        primaryTrigger.data.config
      );
      const scheduled = triggerNodes.find(
        (n) => n.data.kind === "SCHEDULED_TIME"
      );

      if (id) {
        await automationClient.update(id, {
          name,
          graph,
          triggerType: storedTriggerType,
          cronExpression: scheduled
            ? String(scheduled.data.config.cronExpression ?? "0 9 * * *")
            : undefined,
        });
      } else {
        const { item } = await automationClient.create({
          organizationId,
          name,
          triggerType: storedTriggerType,
          graph,
          cronExpression: scheduled
            ? String(scheduled.data.config.cronExpression ?? "0 9 * * *")
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

  const applySheetToNodes = useCallback(
    (sheet: SheetExportRecord) => {
      setLinkedSheet(sheet);
      setNodes((nds) =>
        nds.map((n) => {
          const data = n.data as WorkflowNodeData;
          if (
            data.kind !== "SHEETS_UPSERT" &&
            data.kind !== "EXTRACT_TO_TABLE"
          ) {
            return n;
          }
          return {
            ...n,
            data: {
              ...data,
              config: {
                ...data.config,
                exportId: sheet.id,
                tableId: sheet.extractionTableId,
                tableName: sheet.extractionTableName,
              },
            },
          };
        })
      );
      setSelectedNode((prev) => {
        if (!prev) return prev;
        const data = prev.data as WorkflowNodeData;
        if (
          data.kind !== "SHEETS_UPSERT" &&
          data.kind !== "EXTRACT_TO_TABLE"
        ) {
          return prev;
        }
        return {
          ...prev,
          data: {
            ...data,
            config: {
              ...data.config,
              exportId: sheet.id,
              tableId: sheet.extractionTableId,
              tableName: sheet.extractionTableName,
            },
          },
        };
      });
    },
    [setNodes]
  );

  const clearSheetFromNodes = useCallback(() => {
    setLinkedSheet(null);
    setNodes((nds) =>
      nds.map((n) => {
        const data = n.data as WorkflowNodeData;
        if (
          data.kind !== "SHEETS_UPSERT" &&
          data.kind !== "EXTRACT_TO_TABLE"
        ) {
          return n;
        }
        return {
          ...n,
          data: {
            ...data,
            config: {
              ...data.config,
              exportId: "",
              tableId: "",
              tableName: "",
            },
          },
        };
      })
    );
    setSelectedNode((prev) => {
      if (!prev) return prev;
      const data = prev.data as WorkflowNodeData;
      if (
        data.kind !== "SHEETS_UPSERT" &&
        data.kind !== "EXTRACT_TO_TABLE"
      ) {
        return prev;
      }
      return {
        ...prev,
        data: {
          ...data,
          config: {
            ...data.config,
            exportId: "",
            tableId: "",
            tableName: "",
          },
        },
      };
    });
  }, [setNodes]);

  const currentGraph = useMemo(
    () => flowToGraph(nodes, edges),
    [nodes, edges]
  );

  const activate = async () => {
    const graph = flowToGraph(nodes, edges);
    const missing = missingIntegrationsForGraph(graph, isConnected);
    if (missing.length > 0) {
      setMessage(
        `Connect ${missing.map(integrationLabel).join(" and ")} before activating`
      );
      setCredentialModal(missing[0]!);
      setPendingNode(null);
      return;
    }

    const gmailOk =
      integrationStatus.gmail.connected &&
      !integrationStatus.gmail.needsReconnect;
    if (
      !isAutomationSetupReady({
        graph,
        gmailOk,
        hasSheet: Boolean(linkedSheet?.spreadsheetUrl),
      })
    ) {
      setMessage(
        "Complete Gmail authorization and link or auto-create a Google Sheet in Setup, then Activate again"
      );
      setSetupOpen(true);
      if (!gmailOk) {
        setCredentialModal("GMAIL");
        setPendingNode(null);
      }
      return;
    }

    let activeId = id;
    if (!activeId) {
      setSaving(true);
      try {
        const graph = flowToGraph(nodes, edges);
        const triggerNodes = graph.nodes.filter((n) => n.type === "trigger");
        if (triggerNodes.length === 0) throw new Error("Add at least one trigger");
        const { item } = await automationClient.create({
          organizationId,
          name,
          triggerType: triggerNodes[0]!.data.kind,
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
    setMessage(
      linkedSheet?.spreadsheetUrl
        ? `Automation activated · Sheet: ${linkedSheet.spreadsheetUrl}`
        : "Automation activated"
    );
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

  const updateSelectedConfig = (key: string, value: unknown) => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;
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
    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      const data = prev.data as WorkflowNodeData;
      return {
        ...prev,
        data: {
          ...data,
          config: { ...data.config, [key]: value },
        },
      };
    });
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
    <>
      <IntegrationCredentialModal
        open={credentialModal !== null}
        integration={credentialModal ?? "GMAIL"}
        node={pendingNode?.def ?? null}
        gmailReconnectUrl={integrationStatus.gmail.reconnectUrl}
        whatsappEncryptionReady={integrationStatus.whatsapp.encryptionReady}
        twilioEncryptionReady={integrationStatus.twilio.encryptionReady}
        onConnected={() => void handleCredentialConnected()}
        onCancel={() => {
          setCredentialModal(null);
          setPendingNode(null);
        }}
      />
      <div className="flex h-[calc(100vh-6.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-linear-to-r from-background via-background to-muted/40 px-4 py-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-sm" aria-hidden>
              ⚡
            </span>
            <div className="min-w-0 flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent text-lg font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
                placeholder="Untitled workflow"
              />
              <p className="text-[11px] text-muted-foreground">
                {nodes.length} node{nodes.length === 1 ? "" : "s"} ·{" "}
                {edges.length} connection{edges.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IntegrationPills status={integrationStatus} />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status === "ACTIVE"
                    ? "animate-pulse bg-emerald-500"
                    : "bg-muted-foreground/60"
                }`}
                aria-hidden
              />
              {status === "ACTIVE" ? "Live" : status}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={testRun}
              disabled={running}
              className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              {running ? "Running…" : "Test run"}
            </button>
            <button
              type="button"
              onClick={activate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              {status === "ACTIVE" ? "Re-activate" : "Activate"}
            </button>
            {id && (
              <button
                type="button"
                onClick={deleteWorkflow}
                title="Delete workflow"
                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      {message && (
        <p className="flex items-center gap-2 border-b border-border bg-muted/70 px-4 py-2 text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          {message}
        </p>
      )}
      {(graphNeedsGmail(currentGraph) || graphNeedsSheetLink(currentGraph)) && (
        // Stays mounted while collapsed so sheet auto-link keeps working.
        <div
          className={
            setupOpen
              ? "max-h-[45vh] overflow-y-auto border-b border-border px-4 py-3"
              : "hidden"
          }
        >
          <div className="mb-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setSetupOpen(false)}
              className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              Collapse ✕
            </button>
          </div>
          <AutomationSetupPanel
            graph={currentGraph}
            workflowName={name}
            workflowStatus={status}
            integrationStatus={integrationStatus}
            onConnectGmail={() => {
              setCredentialModal("GMAIL");
              setPendingNode(null);
            }}
            onRefreshIntegrations={refreshIntegrations}
            onSheetReady={applySheetToNodes}
            onSheetCleared={clearSheetFromNodes}
            selectedExportId={
              linkedSheet?.id ??
              (nodes
                .map((n) => n.data as WorkflowNodeData)
                .find(
                  (d) =>
                    d.kind === "SHEETS_UPSERT" || d.kind === "EXTRACT_TO_TABLE"
                )?.config.exportId as string | undefined)
            }
          />
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <NodePalette onAdd={onAddNode} isConnected={isConnected} />
        <div className="flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodesDelete={onNodesDelete}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
              setSelectedNode(node);
              setInspectorOpen(true);
            }}
            onPaneClick={() => setSelectedNode(null)}
            deleteKeyCode={["Backspace", "Delete"]}
            elementsSelectable
            fitView
            colorMode={resolved}
            className="bg-muted/30"
            defaultEdgeOptions={{
              animated: status === "ACTIVE",
              style: { strokeWidth: 2 },
            }}
          >
            <Background gap={18} size={1.5} />
            <Controls className="rounded-xl! border! border-border! bg-background! shadow-md!" />
            <MiniMap
              pannable
              zoomable
              className="rounded-xl! border! border-border! shadow-md!"
              maskColor="rgba(0,0,0,0.08)"
            />
            <Panel
              position="top-left"
              className="rounded-xl border border-border bg-background/95 px-3.5 py-2 text-xs text-muted-foreground shadow-md backdrop-blur"
            >
              <span className="font-medium text-foreground">Canvas</span>
              {" · "}drag nodes from the left, connect trigger → actions
            </Panel>
            {(graphNeedsGmail(currentGraph) ||
              graphNeedsSheetLink(currentGraph)) && (
              <Panel
                position="top-right"
                className="w-56 space-y-1.5 rounded-xl border border-border bg-background/95 p-2.5 shadow-md backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Connections
                  </p>
                  <button
                    type="button"
                    onClick={() => setSetupOpen((v) => !v)}
                    className="rounded-md border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground hover:bg-muted"
                  >
                    {setupOpen ? "Hide setup" : "Setup"}
                  </button>
                </div>
                {graphNeedsGmail(currentGraph) && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        integrationStatus.gmail.connected &&
                        !integrationStatus.gmail.needsReconnect
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                      aria-hidden
                    />
                    <span className="font-medium">Gmail</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {integrationStatus.gmail.connected &&
                      !integrationStatus.gmail.needsReconnect
                        ? "Connected"
                        : "Needed"}
                    </span>
                  </div>
                )}
                {graphNeedsSheetLink(currentGraph) && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        linkedSheet?.spreadsheetUrl
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                      aria-hidden
                    />
                    <span className="font-medium">Google Sheet</span>
                    {linkedSheet?.spreadsheetUrl ? (
                      <a
                        href={linkedSheet.spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-[10px] font-medium text-emerald-700 underline dark:text-emerald-300"
                      >
                        Open ↗
                      </a>
                    ) : (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        Needed
                      </span>
                    )}
                  </div>
                )}
              </Panel>
            )}
            {triggerCount === 0 && (
              <Panel
                position="top-center"
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-md dark:text-amber-200"
              >
                No trigger — add one from the palette to make this workflow runnable
              </Panel>
            )}
          </ReactFlow>
        </div>
        {!inspectorOpen && (
          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            className="flex w-9 shrink-0 flex-col items-center justify-center gap-2 border-l border-border bg-sidebar/50 text-muted-foreground transition hover:bg-muted"
            title="Open inspector"
          >
            <span className="text-xs" aria-hidden>
              ◀
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] [writing-mode:vertical-rl]">
              Inspector
            </span>
          </button>
        )}
        <aside
          className={`${
            inspectorOpen ? "flex" : "hidden"
          } w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar/50`}
        >
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Node inspector
              </p>
              <button
                type="button"
                onClick={() => setInspectorOpen(false)}
                className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
                title="Collapse inspector"
              >
                ✕
              </button>
            </div>
            {selectedNode ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-start justify-between gap-2 rounded-xl border border-border bg-background p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {(selectedNode.data as WorkflowNodeData).label}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {selectedNode.type === "trigger" ? "Trigger" : "Action"} ·{" "}
                      {(selectedNode.data as WorkflowNodeData).kind}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={deleteSelectedNode}
                    className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-[10px] font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                  >
                    Remove
                  </button>
                </div>
                <NodeConfigPanel
                  node={selectedNode.data as WorkflowNodeData}
                  nodeType={selectedNode.type as "trigger" | "action"}
                  onChange={replaceSelectedConfig}
                  onFieldChange={updateSelectedConfig}
                />
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-border bg-background/60 p-4 text-center">
                <p className="text-xs font-medium text-foreground">
                  Nothing selected
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Click a node on the canvas to edit it. Use{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                    {"{{trigger.body}}"}
                  </code>{" "}
                  in text fields for dynamic values.
                </p>
              </div>
            )}
          </div>

          {linkedSheet?.spreadsheetUrl && (
            <div className="border-b border-border p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Linked sheet
              </p>
              <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                  Auto-sync live
                </p>
                <a
                  href={linkedSheet.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 block break-all text-[11px] font-medium text-emerald-700 underline dark:text-emerald-300"
                >
                  {linkedSheet.spreadsheetUrl}
                </a>
              </div>
            </div>
          )}

          <div className="flex-1 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Recent runs
              </p>
              {executions.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {executions.length}
                </span>
              )}
            </div>
            {executions.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-border bg-background/60 p-3 text-center text-[11px] text-muted-foreground">
                No runs yet — use Test run to try the workflow
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {(
                  executions as Array<{
                    id: string;
                    status: string;
                    startedAt: string;
                    errorMessage?: string | null;
                  }>
                )
                  .slice(0, 6)
                  .map((ex) => {
                    const good =
                      ex.status === "SUCCESS" || ex.status === "COMPLETED";
                    const bad = ex.status === "FAILED";
                    return (
                      <li
                        key={ex.id}
                        className="rounded-xl border border-border bg-background px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                              good
                                ? "text-emerald-700 dark:text-emerald-300"
                                : bad
                                  ? "text-red-700 dark:text-red-300"
                                  : "text-foreground"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                good
                                  ? "bg-emerald-500"
                                  : bad
                                    ? "bg-red-500"
                                    : "bg-amber-500"
                              }`}
                              aria-hidden
                            />
                            {ex.status}
                          </span>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {new Date(ex.startedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {new Date(ex.startedAt).toLocaleDateString()}
                        </p>
                        {ex.errorMessage && (
                          <p className="mt-1 line-clamp-3 text-[10px] text-amber-700 dark:text-amber-300">
                            {ex.errorMessage}
                          </p>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
            <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
              Authorize Gmail and link a sheet in the setup bar above, or use{" "}
              <a href="/create" className="underline hover:text-foreground">
                Ask AI
              </a>{" "}
              to build a full product from one prompt.
            </p>
          </div>
        </aside>
      </div>
    </div>
    </>
  );
}

function IntegrationPills({ status }: { status: IntegrationStatusState }) {
  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          status.gmail.connected && !status.gmail.needsReconnect
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            : "bg-muted text-muted-foreground"
        }`}
      >
        Gmail {status.gmail.connected ? "●" : "○"}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          status.whatsapp.connected
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            : "bg-muted text-muted-foreground"
        }`}
      >
        WhatsApp {status.whatsapp.connected ? "●" : "○"}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          status.twilio.connected
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            : "bg-muted text-muted-foreground"
        }`}
      >
        Twilio {status.twilio.connected ? "●" : "○"}
      </span>
    </div>
  );
}
