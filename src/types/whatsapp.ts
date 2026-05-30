/**
 * WhatsApp Business Cloud API domain types.
 */

export type WhatsAppConnectInput = {
  organizationId: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  webhookVerifyToken: string;
  displayPhoneNumber: string;
  metaAppId?: string;
};

export type WhatsAppWebhookVerifyQuery = {
  "hub.mode": string;
  "hub.verify_token": string;
  "hub.challenge": string;
};

export type WhatsAppSendTextInput = {
  connectedAccountId: string;
  recipientPhone: string;
  body: string;
  replyToMessageId?: string;
};

export type WhatsAppSendTemplateInput = {
  connectedAccountId: string;
  recipientPhone: string;
  templateName: string;
  languageCode: string;
  components?: unknown[];
};

export type WhatsAppSendMediaInput = {
  connectedAccountId: string;
  recipientPhone: string;
  mediaType: "image" | "video" | "audio" | "document";
  mediaIdOrLink: string;
  caption?: string;
  filename?: string;
};

export type WhatsAppAccountSummary = {
  id: string;
  displayPhone: string;
  phoneNumberId: string;
  businessAccountId: string | null;
  status: string;
  lastSyncedAt: string | null;
};

export type WhatsAppTemplateSummary = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string | null;
};
