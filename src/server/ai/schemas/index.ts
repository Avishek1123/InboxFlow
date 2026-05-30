import { z } from "zod";

export const summarySchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()).default([]),
  actionItems: z.array(z.string()).default([]),
  language: z.string().optional(),
});

export const leadExtractionSchema = z.object({
  isLead: z.boolean(),
  confidence: z.number().min(0).max(1),
  contact: z
    .object({
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      company: z.string().nullable().optional(),
    })
    .optional(),
  intent: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
  timeline: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const orderExtractionSchema = z.object({
  isOrder: z.boolean(),
  confidence: z.number().min(0).max(1),
  orderId: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().optional(),
        unitPrice: z.number().nullable().optional(),
        currency: z.string().optional(),
      })
    )
    .default([]),
  totalAmount: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  shippingAddress: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

export const invoiceExtractionSchema = z.object({
  isInvoice: z.boolean(),
  confidence: z.number().min(0).max(1),
  invoiceNumber: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  customer: z.string().nullable().optional(),
  issueDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number().nullable().optional(),
      })
    )
    .default([]),
  subtotal: z.number().nullable().optional(),
  tax: z.number().nullable().optional(),
  total: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
});

export const sentimentSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  emotions: z.array(z.string()).default([]),
  rationale: z.string().optional(),
});

export const intentSchema = z.object({
  primaryIntent: z.string(),
  secondaryIntents: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum([
    "sales",
    "support",
    "billing",
    "shipping",
    "complaint",
    "inquiry",
    "spam",
    "other",
  ]),
  suggestedTags: z.array(z.string()).default([]),
});

export const autoReplySchema = z.object({
  reply: z.string(),
  tone: z.string().optional(),
  shouldEscalate: z.boolean().default(false),
  escalationReason: z.string().nullable().optional(),
  suggestedFollowUp: z.string().nullable().optional(),
});

export const fullAnalysisSchema = z.object({
  summary: summarySchema,
  sentiment: sentimentSchema,
  intent: intentSchema,
  lead: leadExtractionSchema,
  order: orderExtractionSchema,
  invoice: invoiceExtractionSchema,
  suggestedReply: autoReplySchema.optional(),
});

export type SummaryResult = z.infer<typeof summarySchema>;
export type LeadResult = z.infer<typeof leadExtractionSchema>;
export type OrderResult = z.infer<typeof orderExtractionSchema>;
export type InvoiceResult = z.infer<typeof invoiceExtractionSchema>;
export type SentimentResult = z.infer<typeof sentimentSchema>;
export type IntentResult = z.infer<typeof intentSchema>;
export type AutoReplyResult = z.infer<typeof autoReplySchema>;
export type FullAnalysisResult = z.infer<typeof fullAnalysisSchema>;

export const taskSchemaMap = {
  SUMMARIZE_EMAIL: summarySchema,
  SUMMARIZE_WHATSAPP: summarySchema,
  EXTRACT_LEAD: leadExtractionSchema,
  EXTRACT_ORDER: orderExtractionSchema,
  EXTRACT_INVOICE: invoiceExtractionSchema,
  SENTIMENT: sentimentSchema,
  INTENT: intentSchema,
  AUTO_REPLY: autoReplySchema,
  FULL_ANALYSIS: fullAnalysisSchema,
} as const;
