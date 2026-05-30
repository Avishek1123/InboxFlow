import type { AutomationTriggerType } from "@prisma/client";

export type TriggerKind =
  | "NEW_GMAIL_EMAIL"
  | "NEW_WHATSAPP_MESSAGE"
  | "SCHEDULED_TIME"
  | "AI_EXTRACTION_COMPLETED";

export type ActionKind =
  | "SEND_EMAIL"
  | "SEND_WHATSAPP"
  | "CREATE_CONTACT"
  | "CALL_OPENAI"
  | "STORE_DATA"
  | "WEBHOOK_REQUEST";

export type WorkflowNodeData = {
  kind: TriggerKind | ActionKind;
  label: string;
  config: Record<string, unknown>;
};

export type WorkflowNode = {
  id: string;
  type: "trigger" | "action";
  position: { x: number; y: number };
  data: WorkflowNodeData;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type WorkflowGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
};

export type AutomationTriggerPayload = {
  messageId?: string;
  conversationId?: string;
  channel?: "GMAIL" | "WHATSAPP";
  from?: string;
  subject?: string;
  body?: string;
  receivedAt?: string;
  aiExtractionId?: string;
  aiResult?: unknown;
  scheduledAt?: string;
  [key: string]: unknown;
};

export type DispatchEvent = {
  organizationId: string;
  triggerType: AutomationTriggerType;
  payload: AutomationTriggerPayload;
};

export type ExecutionContext = {
  trigger: AutomationTriggerPayload;
  variables: Record<string, unknown>;
  lastOutput?: unknown;
};

export type MonitoringStats = {
  totalAutomations: number;
  activeAutomations: number;
  executions24h: number;
  successRate24h: number;
  failedPendingRetry: number;
};
