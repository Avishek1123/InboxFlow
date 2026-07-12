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
        "Complete Gmail authorization and link or auto-create a Google Sheet below, then Activate again"
      );
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
      <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-[200px] flex-1 bg-transparent text-lg font-semibold outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <IntegrationPills status={integrationStatus} />
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
      {(graphNeedsGmail(currentGraph) || graphNeedsSheetLink(currentGraph)) && (
        <div className="border-b border-border px-4 py-3">
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
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            deleteKeyCode={["Backspace", "Delete"]}
            elementsSelectable
            fitView
            colorMode={resolved}
            className="bg-muted/30"
          >
            <Background />
            <Controls />
            <MiniMap />
            <Panel position="top-left" className="rounded-lg border border-border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
              Drag nodes onto the canvas • Connect trigger → actions • n8n-style flows
            </Panel>
          </ReactFlow>
        </div>
        <aside className="w-72 shrink-0 border-l border-border p-3 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Parameters
          </p>
          {selectedNode ? (
            <div className="mt-2 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {(selectedNode.data as WorkflowNodeData).label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(selectedNode.data as WorkflowNodeData).kind}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={deleteSelectedNode}
                  className="shrink-0 rounded border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                >
                  Delete
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
            <p className="mt-2 text-xs text-muted-foreground">
              Select a node to edit parameters. Use {"{{trigger.body}}"} in text
              fields for dynamic values.
            </p>
          )}
          <p className="mt-6 text-xs font-semibold uppercase text-muted-foreground">
            Recent runs
          </p>
          <ul className="mt-1 space-y-2">
            {(
              executions as Array<{
                id: string;
                status: string;
                startedAt: string;
                errorMessage?: string | null;
              }>
            )
              .slice(0, 5)
              .map((ex) => (
                <li
                  key={ex.id}
                  className="rounded border border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{ex.status}</span>
                  {" · "}
                  {new Date(ex.startedAt).toLocaleString()}
                  {ex.errorMessage && (
                    <p className="mt-0.5 line-clamp-3 text-amber-700 dark:text-amber-300">
                      {ex.errorMessage}
                    </p>
                  )}
                </li>
              ))}
          </ul>
          {linkedSheet?.spreadsheetUrl && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Active sheet
              </p>
              <a
                href={linkedSheet.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-[11px] font-medium text-emerald-700 underline dark:text-emerald-300"
              >
                {linkedSheet.spreadsheetUrl}
              </a>
            </div>
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Authorize Gmail and link/auto-create a sheet in the setup bar above.
            Use <a href="/create" className="underline hover:text-foreground">Ask AI</a>{" "}
            to build from a prompt.
          </p>
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
