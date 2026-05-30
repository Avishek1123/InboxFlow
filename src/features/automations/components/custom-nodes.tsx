"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getDefinition } from "@/lib/automation/definitions";
import type { WorkflowNodeData } from "@/types/automation";

export function TriggerNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const def = getDefinition(d.kind);
  return (
    <div
      className={`min-w-[180px] rounded-lg border-2 bg-background px-3 py-2 shadow-sm ${selected ? "border-primary" : "border-border"}`}
      style={{ borderLeftColor: def?.color ?? "#6366f1", borderLeftWidth: 4 }}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Trigger
      </p>
      <p className="text-sm font-semibold">{d.label}</p>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const def = getDefinition(d.kind);
  return (
    <div
      className={`min-w-[180px] rounded-lg border-2 bg-background px-3 py-2 shadow-sm ${selected ? "border-primary" : "border-border"}`}
      style={{ borderLeftColor: def?.color ?? "#64748b", borderLeftWidth: 4 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Action
      </p>
      <p className="text-sm font-semibold">{d.label}</p>
      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}

export const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
};
