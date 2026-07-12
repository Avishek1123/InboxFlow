import { z } from "zod";

const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["trigger", "action"]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    kind: z.string(),
    label: z.string(),
    config: z.record(z.string(), z.unknown()),
  }),
});

const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

export const workflowGraphSchema = z.object({
  nodes: z.array(workflowNodeSchema).min(1),
  edges: z.array(workflowEdgeSchema),
  viewport: z
    .object({ x: z.number(), y: z.number(), zoom: z.number() })
    .optional(),
});

export const createAutomationSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  triggerType: z.enum([
    "NEW_GMAIL_EMAIL",
    "NEW_WHATSAPP_MESSAGE",
    "NEW_SMS",
    "NEW_TWILIO_WHATSAPP",
    "SCHEDULED_TIME",
    "AI_EXTRACTION_COMPLETED",
  ]),
  graph: workflowGraphSchema,
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
});

export const updateAutomationSchema = createAutomationSchema
  .partial()
  .extend({ status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional() });

export const dispatchEventSchema = z.object({
  organizationId: z.string().min(1),
  triggerType: z.enum([
    "NEW_GMAIL_EMAIL",
    "NEW_WHATSAPP_MESSAGE",
    "NEW_SMS",
    "NEW_TWILIO_WHATSAPP",
    "SCHEDULED_TIME",
    "AI_EXTRACTION_COMPLETED",
  ]),
  payload: z.record(z.string(), z.unknown()),
});

export const testRunSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
});
