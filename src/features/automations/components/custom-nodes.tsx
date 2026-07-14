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
      className="flex items-center justify-center rounded-md bg-muted text-[10px] font-bold"
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
  return def?.description?.slice(0, 56) ?? null;
}

/** Key config values worth surfacing on the card. */
function nodeConfigChips(d: WorkflowNodeData): string[] {
  const chips: string[] = [];
  const cfg = d.config as Record<string, unknown>;
  if (typeof cfg.tableName === "string" && cfg.tableName) {
    chips.push(String(cfg.tableName));
  }
  if (typeof cfg.sheetTitle === "string" && cfg.sheetTitle) {
    chips.push(String(cfg.sheetTitle));
  }
  if (typeof cfg.cronExpression === "string" && cfg.cronExpression) {
    chips.push(String(cfg.cronExpression));
  }
  return chips.slice(0, 2);
}

function CanvasNode({
  data,
  selected,
  nodeType,
}: NodeProps & { nodeType: "trigger" | "action" }) {
  const d = data as WorkflowNodeData;
  const def = getDefinition(d.kind);
  const app = def?.app ?? getAppForKind(d.kind);
  const accent = def?.color ?? (nodeType === "trigger" ? "#f59e0b" : "#10b981");
  const subtitle = nodeSubtitle(d);
  const chips = nodeConfigChips(d);

  return (
    <div
      className={`group relative min-w-[210px] max-w-[250px] rounded-2xl border bg-background shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-200 ${
        selected
          ? "border-primary shadow-[0_8px_28px_rgba(0,0,0,0.14)] ring-2 ring-primary/25"
          : "border-border hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      }`}
    >
      <span
        className="absolute inset-y-3 left-0 w-1 rounded-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />

      {nodeType === "action" && (
        <Handle
          type="target"
          position={Position.Left}
          className="h-3! w-3! border-2! border-background! bg-primary!"
        />
      )}

      <div className="flex items-center gap-2.5 px-3.5 pb-1.5 pt-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70"
          style={{ backgroundColor: `${accent}14` }}
        >
          <NodeAppIcon app={app} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight">
            {d.label}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            {nodeType === "trigger" ? "Trigger" : "Action"}
          </p>
        </div>
      </div>

      {subtitle && (
        <p className="px-3.5 pb-2 text-[10px] leading-snug text-muted-foreground line-clamp-2">
          {subtitle}
        </p>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 border-t border-border/70 px-3.5 py-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="h-3! w-3! border-2! border-background! bg-primary!"
      />
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
