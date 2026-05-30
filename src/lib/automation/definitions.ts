import type { ActionKind, TriggerKind } from "@/types/automation";

export type NodeDefinition = {
  kind: TriggerKind | ActionKind;
  type: "trigger" | "action";
  label: string;
  description: string;
  color: string;
  defaultConfig: Record<string, unknown>;
};

export const TRIGGER_DEFINITIONS: NodeDefinition[] = [
  {
    kind: "NEW_GMAIL_EMAIL",
    type: "trigger",
    label: "New Gmail Email",
    description: "Runs when a new Gmail message is synced",
    color: "#ea4335",
    defaultConfig: {
      filterPresetIds: [] as string[],
      filterLabels: [] as string[],
      filterMode: "any",
    },
  },
  {
    kind: "NEW_WHATSAPP_MESSAGE",
    type: "trigger",
    label: "New WhatsApp Message",
    description: "Runs when an inbound WhatsApp message arrives",
    color: "#25d366",
    defaultConfig: { messageTypes: ["text"] },
  },
  {
    kind: "SCHEDULED_TIME",
    type: "trigger",
    label: "Scheduled Time",
    description: "Runs on a cron schedule",
    color: "#6366f1",
    defaultConfig: { cronExpression: "0 9 * * *", timezone: "UTC" },
  },
  {
    kind: "AI_EXTRACTION_COMPLETED",
    type: "trigger",
    label: "AI Extraction Completed",
    description: "Runs after AI finishes analyzing a message",
    color: "#8b5cf6",
    defaultConfig: { taskTypes: ["FULL_ANALYSIS"] },
  },
];

export const ACTION_DEFINITIONS: NodeDefinition[] = [
  {
    kind: "SEND_EMAIL",
    type: "action",
    label: "Send Email",
    description: "Send an email via connected Gmail",
    color: "#ea4335",
    defaultConfig: {
      to: "{{trigger.from}}",
      subject: "Re: {{trigger.subject}}",
      body: "Thank you for your message.",
    },
  },
  {
    kind: "SEND_WHATSAPP",
    type: "action",
    label: "Send WhatsApp",
    description: "Send a WhatsApp message",
    color: "#25d366",
    defaultConfig: {
      to: "{{trigger.from}}",
      body: "Thanks for reaching out!",
    },
  },
  {
    kind: "CREATE_CONTACT",
    type: "action",
    label: "Create Contact",
    description: "Create or update a CRM contact",
    color: "#0ea5e9",
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
    description: "Run AI analysis (Groq/Gemini/OpenRouter)",
    color: "#8b5cf6",
    defaultConfig: {
      task: "FULL_ANALYSIS",
      replyTone: "professional",
    },
  },
  {
    kind: "STORE_DATA",
    type: "action",
    label: "Store Data",
    description: "Persist key-value data from the workflow",
    color: "#f59e0b",
    defaultConfig: {
      key: "last_run",
      valueTemplate: "{{lastOutput}}",
    },
  },
  {
    kind: "WEBHOOK_REQUEST",
    type: "action",
    label: "Webhook Request",
    description: "POST data to an external URL",
    color: "#64748b",
    defaultConfig: {
      url: "https://example.com/webhook",
      method: "POST",
      headers: {},
      bodyTemplate: "{{trigger}}",
    },
  },
];

export const ALL_DEFINITIONS = [...TRIGGER_DEFINITIONS, ...ACTION_DEFINITIONS];

export function getDefinition(kind: string): NodeDefinition | undefined {
  return ALL_DEFINITIONS.find((d) => d.kind === kind);
}
