import type { AutomationTriggerType } from "@prisma/client";
import { integrationForMessaging } from "@/lib/messaging/channels";
import type { WorkflowGraph, WorkflowNode } from "@/types/automation";
import { getTriggerNodes } from "@/server/automation/graph";

/** Maps unified messaging config → concrete dispatch trigger type. */
export function messagingOptionToTriggerType(
  optionId: string
): AutomationTriggerType | null {
  switch (optionId) {
    case "meta_whatsapp":
      return "NEW_WHATSAPP_MESSAGE";
    case "twilio_sms":
      return "NEW_SMS";
    case "twilio_whatsapp":
      return "NEW_TWILIO_WHATSAPP";
    default:
      return null;
  }
}

/** Resolve DB `triggerType` from a graph trigger node (n8n-style unified triggers). */
export function resolveStoredTriggerType(
  kind: string,
  config: Record<string, unknown>
): AutomationTriggerType {
  if (kind === "MESSAGE_RECEIVED") {
    const mapped = messagingOptionToTriggerType(
      String(config.messagingOption ?? "meta_whatsapp")
    );
    if (mapped) return mapped;
  }
  return kind as AutomationTriggerType;
}

export function triggerNodeMatchesEvent(
  node: WorkflowNode,
  eventTriggerType: AutomationTriggerType
): boolean {
  const kind = node.data.kind;

  if (kind === eventTriggerType) return true;

  if (kind === "MESSAGE_RECEIVED") {
    const mapped = messagingOptionToTriggerType(
      String(node.data.config.messagingOption ?? "")
    );
    return mapped === eventTriggerType;
  }

  return false;
}

export function findTriggerNodesForEvent(
  graph: WorkflowGraph,
  eventTriggerType: AutomationTriggerType
): WorkflowNode[] {
  return getTriggerNodes(graph).filter((n) =>
    triggerNodeMatchesEvent(n, eventTriggerType)
  );
}

export function integrationForNodeConfig(
  kind: string,
  config: Record<string, unknown>
): "GMAIL" | "WHATSAPP" | "TWILIO" | undefined {
  if (kind === "MESSAGE_RECEIVED" || kind === "SEND_MESSAGE") {
    return integrationForMessaging(String(config.messagingOption ?? ""));
  }
  return undefined;
}
