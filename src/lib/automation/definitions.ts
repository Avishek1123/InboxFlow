import type { ActionKind, TriggerKind } from "@/types/automation";

export type IntegrationRequirement = "GMAIL" | "WHATSAPP" | "TWILIO";

export type NodeAppId =
  | "gmail"
  | "messages"
  | "twilio"
  | "schedule"
  | "ai"
  | "utilities";

export type NodeDefinition = {
  kind: TriggerKind | ActionKind;
  type: "trigger" | "action";
  label: string;
  description: string;
  color: string;
  defaultConfig: Record<string, unknown>;
  app: NodeAppId;
  /** Prompt to connect this integration before adding the node. */
  requiredIntegration?: IntegrationRequirement;
  /** Legacy nodes — still execute but hidden from the n8n-style palette. */
  hidden?: boolean;
};

export const TRIGGER_DEFINITIONS: NodeDefinition[] = [
  {
    kind: "NEW_GMAIL_EMAIL",
    type: "trigger",
    label: "On new email",
    description: "When a new Gmail message is synced",
    color: "#ea4335",
    app: "gmail",
    defaultConfig: {
      filterPresetIds: [] as string[],
      filterLabels: [] as string[],
      filterMode: "any",
    },
    requiredIntegration: "GMAIL",
  },
  {
    kind: "MESSAGE_RECEIVED",
    type: "trigger",
    label: "On message received",
    description: "WhatsApp or SMS — pick provider in parameters",
    color: "#25d366",
    app: "messages",
    defaultConfig: { messagingOption: "meta_whatsapp" },
  },
  {
    kind: "NEW_WHATSAPP_MESSAGE",
    type: "trigger",
    label: "On WhatsApp (Meta)",
    description: "Legacy — use On message received",
    color: "#25d366",
    app: "messages",
    defaultConfig: { messageTypes: ["text"] },
    requiredIntegration: "WHATSAPP",
    hidden: true,
  },
  {
    kind: "NEW_SMS",
    type: "trigger",
    label: "On SMS (Twilio)",
    description: "Legacy",
    color: "#f22f46",
    app: "twilio",
    defaultConfig: {},
    requiredIntegration: "TWILIO",
    hidden: true,
  },
  {
    kind: "NEW_TWILIO_WHATSAPP",
    type: "trigger",
    label: "On WhatsApp (Twilio)",
    description: "Legacy",
    color: "#25d366",
    app: "twilio",
    defaultConfig: {},
    requiredIntegration: "TWILIO",
    hidden: true,
  },
  {
    kind: "SCHEDULED_TIME",
    type: "trigger",
    label: "On schedule",
    description: "Runs on a cron schedule",
    color: "#6366f1",
    app: "schedule",
    defaultConfig: { cronExpression: "0 9 * * *", timezone: "UTC" },
  },
  {
    kind: "AI_EXTRACTION_COMPLETED",
    type: "trigger",
    label: "On AI extraction done",
    description: "After AI finishes analyzing a message",
    color: "#8b5cf6",
    app: "ai",
    defaultConfig: { taskTypes: ["FULL_ANALYSIS"] },
  },
];

export const ACTION_DEFINITIONS: NodeDefinition[] = [
  {
    kind: "SEND_EMAIL",
    type: "action",
    label: "Send email",
    description: "Send via connected Gmail",
    color: "#ea4335",
    app: "gmail",
    defaultConfig: {
      to: "{{trigger.from}}",
      subject: "Re: {{trigger.subject}}",
      body: "Thank you for your message.",
    },
    requiredIntegration: "GMAIL",
  },
  {
    kind: "SEND_MESSAGE",
    type: "action",
    label: "Send message",
    description: "WhatsApp or SMS — pick provider in parameters",
    color: "#25d366",
    app: "messages",
    defaultConfig: {
      messagingOption: "meta_whatsapp",
      to: "{{trigger.from}}",
      body: "Thanks for reaching out!",
    },
  },
  {
    kind: "SEND_WHATSAPP",
    type: "action",
    label: "Send WhatsApp (Meta)",
    description: "Legacy",
    color: "#25d366",
    app: "messages",
    defaultConfig: {
      to: "{{trigger.from}}",
      body: "Thanks for reaching out!",
    },
    requiredIntegration: "WHATSAPP",
    hidden: true,
  },
  {
    kind: "SEND_SMS",
    type: "action",
    label: "Send SMS (Twilio)",
    description: "Legacy",
    color: "#f22f46",
    app: "twilio",
    defaultConfig: {
      to: "{{trigger.from}}",
      body: "Thanks for your message!",
    },
    requiredIntegration: "TWILIO",
    hidden: true,
  },
  {
    kind: "SEND_TWILIO_WHATSAPP",
    type: "action",
    label: "Send WhatsApp (Twilio)",
    description: "Legacy",
    color: "#25d366",
    app: "twilio",
    defaultConfig: {
      to: "{{trigger.from}}",
      body: "Thanks for reaching out!",
    },
    requiredIntegration: "TWILIO",
    hidden: true,
  },
  {
    kind: "CREATE_CONTACT",
    type: "action",
    label: "Create contact",
    description: "Create or update a CRM contact",
    color: "#0ea5e9",
    app: "utilities",
    defaultConfig: {
      name: "{{trigger.from}}",
      email: "{{trigger.from}}",
      phone: "",
      company: "",
      source: "automation",
    },
  },
  {
    kind: "CALL_OPENAI",
    type: "action",
    label: "Call AI",
    description: "Groq, Gemini, or OpenRouter",
    color: "#8b5cf6",
    app: "ai",
    defaultConfig: {
      task: "FULL_ANALYSIS",
      replyTone: "professional",
    },
  },
  {
    kind: "STORE_DATA",
    type: "action",
    label: "Store data",
    description: "Save key-value data from the workflow",
    color: "#f59e0b",
    app: "utilities",
    defaultConfig: {
      key: "last_run",
      valueTemplate: "{{lastOutput}}",
    },
  },
  {
    kind: "WEBHOOK_REQUEST",
    type: "action",
    label: "HTTP request",
    description: "POST data to an external URL",
    color: "#64748b",
    app: "utilities",
    defaultConfig: {
      url: "https://example.com/webhook",
      method: "POST",
      headers: {},
      bodyTemplate: "{{trigger}}",
    },
  },
  {
    kind: "RUN_AGENT",
    type: "action",
    label: "AI Agent",
    description: "Autonomous tool-calling agent for this goal",
    color: "#7c3aed",
    app: "ai",
    defaultConfig: {
      goal: "Process this message: extract key fields, update linked tables/sheets, summarize next steps.",
      maxSteps: 6,
      allowSendTools: false,
    },
  },
  {
    kind: "REQUEST_APPROVAL",
    type: "action",
    label: "Ask for approval",
    description: "Pause until a human approves",
    color: "#f97316",
    app: "utilities",
    defaultConfig: {
      summary: "Please approve the next agent action",
    },
  },
  {
    kind: "CONDITION",
    type: "action",
    label: "Condition",
    description: "Branch / skip remaining steps when false",
    color: "#14b8a6",
    app: "utilities",
    defaultConfig: {
      left: "{{variables.conditionMet}}",
      operator: "truthy",
      right: "",
      skipWhenFalse: true,
    },
  },
  {
    kind: "WAIT",
    type: "action",
    label: "Wait",
    description: "Pause briefly (max 30s) before next step",
    color: "#94a3b8",
    app: "schedule",
    defaultConfig: { seconds: 2 },
  },
  {
    kind: "QUERY_INBOX",
    type: "action",
    label: "Search inbox",
    description: "Find recent Gmail/WhatsApp/SMS messages",
    color: "#0ea5e9",
    app: "utilities",
    defaultConfig: { query: "", channel: "", limit: 10 },
  },
  {
    kind: "QUERY_TABLE",
    type: "action",
    label: "Query data table",
    description: "Read rows from an extraction table",
    color: "#06b6d4",
    app: "utilities",
    defaultConfig: { tableName: "", limit: 20 },
  },
  {
    kind: "EXTRACT_TO_TABLE",
    type: "action",
    label: "Extract to table",
    description: "AI-extract current message into a table",
    color: "#8b5cf6",
    app: "ai",
    defaultConfig: {
      tableName: "",
      tableId: "",
      exportId: "",
      messageId: "{{trigger.messageId}}",
    },
  },
  {
    kind: "SHEETS_UPSERT",
    type: "action",
    label: "Sync Google Sheet",
    description: "Push linked extraction table to Google Sheets",
    color: "#22c55e",
    app: "utilities",
    requiredIntegration: "GMAIL",
    defaultConfig: {
      messageId: "{{trigger.messageId}}",
      exportId: "",
      tableId: "",
    },
  },
  {
    kind: "MEMORY_SET",
    type: "action",
    label: "Remember fact",
    description: "Save a customer memory fact",
    color: "#eab308",
    app: "utilities",
    defaultConfig: {
      key: "note",
      value: "{{lastOutput}}",
    },
  },
];

export const ALL_DEFINITIONS = [...TRIGGER_DEFINITIONS, ...ACTION_DEFINITIONS];

export function getDefinition(kind: string): NodeDefinition | undefined {
  return ALL_DEFINITIONS.find((d) => d.kind === kind);
}
