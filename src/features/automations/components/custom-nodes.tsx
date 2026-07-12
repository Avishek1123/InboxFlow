"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GmailIcon } from "@/components/icons/gmail-icon";
import { TwilioIcon } from "@/components/icons/twilio-icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { getAppForKind } from "@/lib/automation/node-catalog";
import { getDefinition } from "@/lib/automation/definitions";
import { MESSAGING_OPTIONS } from "@/lib/messaging/channels";
import type { WorkflowNodeData } from "@/types/automation";
import type { NodeAppId } from "@/lib/automation/definitions";

function NodeAppIcon({ app, size }: { app: NodeAppId; size: number }) {
  if (app === "gmail") return <GmailIcon size={size} />;
  if (app === "twilio") return <TwilioIcon size={size} />;
  if (app === "messages") return <WhatsAppIcon size={size} />;
  return (
    <span
      className="flex items-center justify-center rounded bg-muted text-[10px] font-bold"
      style={{ width: size, height: size }}
    >
      {app[0]?.toUpperCase()}
    </span>
  );
}

function nodeSubtitle(d: WorkflowNodeData): string | null {
  if (d.kind === "MESSAGE_RECEIVED" || d.kind === "SEND_MESSAGE") {
    const id = String(d.config.messagingOption ?? "");
    return MESSAGING_OPTIONS.find((o) => o.id === id)?.label ?? null;
  }
  const def = getDefinition(d.kind);
  return def?.description?.slice(0, 48) ?? null;
}

function CanvasNode({
  data,
  selected,
  nodeType,
}: NodeProps & { nodeType: "trigger" | "action" }) {
  const d = data as WorkflowNodeData;
  const def = getDefinition(d.kind);
  const app = def?.app ?? getAppForKind(d.kind);

  return (
    <div
      className={`min-w-[200px] max-w-[240px] rounded-xl border-2 bg-background shadow-md transition-shadow ${
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      {nodeType === "action" && (
        <Handle type="target" position={Position.Left} className="!bg-primary !h-2.5 !w-2.5" />
      )}
      <div
        className="flex items-center gap-2 rounded-t-[10px] px-3 py-2"
        style={{ backgroundColor: `${def?.color ?? "#64748b"}18` }}
      >
        <NodeAppIcon app={app} size={20} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{d.label}</p>
          <p className="text-[10px] capitalize text-muted-foreground">{nodeType}</p>
        </div>
      </div>
      {nodeSubtitle(d) && (
        <p className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground line-clamp-2">
          {nodeSubtitle(d)}
        </p>
      )}
      {nodeType === "trigger" && (
        <Handle type="source" position={Position.Right} className="!bg-primary !h-2.5 !w-2.5" />
      )}
      {nodeType === "action" && (
        <Handle type="source" position={Position.Right} className="!bg-primary !h-2.5 !w-2.5" />
      )}
    </div>
  );
}

export function TriggerNode(props: NodeProps) {
  return <CanvasNode {...props} nodeType="trigger" />;
}

export function ActionNode(props: NodeProps) {
  return <CanvasNode {...props} nodeType="action" />;
}

export const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
};
