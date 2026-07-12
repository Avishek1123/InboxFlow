import type { AutomationTriggerType } from "@prisma/client";
import type { WorkflowGraph, WorkflowNode } from "@/types/automation";
import { TRIGGER_DEFINITIONS } from "@/lib/automation/definitions";
import {
  findTriggerNodesForEvent as matchTriggersForEvent,
  triggerNodeMatchesEvent,
} from "@/lib/automation/trigger-matching";
import { AutomationEngineError } from "./errors";

const TRIGGER_KINDS = new Set(TRIGGER_DEFINITIONS.map((t) => t.kind));

export function getTriggerNodes(graph: WorkflowGraph): WorkflowNode[] {
  return graph.nodes.filter(
    (n) => n.type === "trigger" || TRIGGER_KINDS.has(n.data.kind as never)
  );
}

export function getTriggerKinds(graph: WorkflowGraph): AutomationTriggerType[] {
  return [
    ...new Set(
      getTriggerNodes(graph).map((n) => n.data.kind as AutomationTriggerType)
    ),
  ];
}

export function findTriggerNodesByKind(
  graph: WorkflowGraph,
  kind: AutomationTriggerType
): WorkflowNode[] {
  return matchTriggersForEvent(graph, kind);
}

export { matchTriggersForEvent as findTriggerNodesForEvent };

export function graphHasTriggerKind(
  graph: unknown,
  kind: AutomationTriggerType
): boolean {
  const g = graph as WorkflowGraph;
  return findTriggerNodesByKind(g, kind).length > 0;
}

export function validateGraph(graph: WorkflowGraph): {
  valid: boolean;
  errors: string[];
  triggerNodes: WorkflowNode[];
  triggerNode: WorkflowNode | null;
  triggerType: AutomationTriggerType | null;
} {
  const errors: string[] = [];

  if (!graph.nodes?.length) {
    return {
      valid: false,
      errors: ["Workflow must have at least one node"],
      triggerNodes: [],
      triggerNode: null,
      triggerType: null,
    };
  }

  const triggers = getTriggerNodes(graph);
  if (triggers.length < 1) {
    errors.push("Workflow must have at least one trigger node");
  }

  const triggerNode = triggers[0] ?? null;
  const triggerType = triggerNode
    ? (triggerNode.data.kind as AutomationTriggerType)
    : null;

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges ?? []) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references missing node`);
    }
  }

  const actionNodes = graph.nodes.filter((n) => n.type === "action");
  if (actionNodes.length === 0) {
    errors.push("Workflow must have at least one action node");
  }

  if (triggers.length > 0 && actionNodes.length > 0) {
    const reachableFromAnyTrigger = new Set<string>();
    for (const trigger of triggers) {
      for (const id of getReachableNodes(graph, trigger.id)) {
        reachableFromAnyTrigger.add(id);
      }
    }
    const unreachable = actionNodes.filter(
      (n) => !reachableFromAnyTrigger.has(n.id)
    );
    if (unreachable.length > 0) {
      errors.push(
        `${unreachable.length} action node(s) are not connected to any trigger`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    triggerNodes: triggers,
    triggerNode,
    triggerType,
  };
}

function getReachableNodes(graph: WorkflowGraph, startId: string): Set<string> {
  const adj = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adj.get(edge.source) ?? [];
    list.push(edge.target);
    adj.set(edge.source, list);
  }

  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of adj.get(id) ?? []) {
      queue.push(next);
    }
  }
  return visited;
}

export function getExecutionOrder(
  graph: WorkflowGraph,
  triggerNodeId: string
): WorkflowNode[] {
  const triggerNode = graph.nodes.find((n) => n.id === triggerNodeId);
  if (!triggerNode) {
    throw new AutomationEngineError(
      "INVALID_GRAPH",
      `Trigger node ${triggerNodeId} not found`
    );
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    adj.set(edge.source, [...(adj.get(edge.source) ?? []), edge.target]);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0 && id === triggerNodeId) queue.push(id);
  }
  if (queue.length === 0) queue.push(triggerNodeId);

  const order: string[] = [];
  const visited = new Set<string>();

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg <= 0) queue.push(next);
    }
  }

  return order
    .map((id) => nodeMap.get(id)!)
    .filter((n) => n.type === "action");
}

export { triggerNodeMatchesEvent };
