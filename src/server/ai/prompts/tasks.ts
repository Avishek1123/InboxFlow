import type { AiTaskType } from "@prisma/client";

export const TASK_PROMPTS: Record<AiTaskType, string> = {
  SUMMARIZE_EMAIL: `Summarize this email for a busy operator.
Return JSON: { "summary": string, "keyPoints": string[], "actionItems": string[], "language"?: string }`,

  SUMMARIZE_WHATSAPP: `Summarize this WhatsApp Business chat message/thread context.
Return JSON: { "summary": string, "keyPoints": string[], "actionItems": string[], "language"?: string }`,

  EXTRACT_LEAD: `Extract lead/sales opportunity data from this message.
Return JSON: { "isLead": boolean, "confidence": 0-1, "contact": { name?, email?, phone?, company? }, "intent"?, "budget"?, "timeline"?, "notes"? }`,

  EXTRACT_ORDER: `Extract purchase order details if present.
Return JSON: { "isOrder": boolean, "confidence": 0-1, "orderId"?, "items": [{ name, quantity?, unitPrice?, currency? }], "totalAmount"?, "currency"?, "shippingAddress"?, "status"? }`,

  EXTRACT_INVOICE: `Extract invoice/billing details if present.
Return JSON: { "isInvoice": boolean, "confidence": 0-1, "invoiceNumber"?, "vendor"?, "customer"?, "issueDate"?, "dueDate"?, "lineItems": [{ description, amount? }], "subtotal"?, "tax"?, "total"?, "currency"? }`,

  SENTIMENT: `Analyze customer sentiment.
Return JSON: { "sentiment": "positive"|"neutral"|"negative"|"mixed", "score": -1 to 1, "confidence": 0-1, "emotions": string[], "rationale"?: string }`,

  INTENT: `Detect primary customer intent and urgency.
Return JSON: { "primaryIntent": string, "secondaryIntents": string[], "confidence": 0-1, "urgency": "low"|"medium"|"high"|"critical", "category": "sales"|"support"|"billing"|"shipping"|"complaint"|"inquiry"|"spam"|"other", "suggestedTags": string[] }`,

  AUTO_REPLY: `Draft a helpful auto-reply to this inbound message.
Return JSON: { "reply": string, "tone"?: string, "shouldEscalate": boolean, "escalationReason"?: string|null, "suggestedFollowUp"?: string|null }`,

  FULL_ANALYSIS: `Perform complete analysis: summary, sentiment, intent, lead, order, invoice extraction, and a suggested reply.
Return JSON: { "summary": {...}, "sentiment": {...}, "intent": {...}, "lead": {...}, "order": {...}, "invoice": {...}, "suggestedReply": {...} }
Use the same sub-schemas as individual tasks.`,
};
