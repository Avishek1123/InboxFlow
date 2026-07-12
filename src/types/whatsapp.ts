/**
 * WhatsApp Business Cloud API — org connection & API types.
 */

export type WhatsAppConnectInput = {
  accessToken: string;
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
};

export type WhatsAppAccountSummary = {
  id: string;
  businessPhone: string;
  phoneNumberId: string;
  whatsappBusinessAccountId: string | null;
  status: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  syncError: string | null;
  webhookUrl: string;
  hasWebhookVerifyToken: boolean;
};

export type WhatsAppStatusResponse = {
  configured: {
    encryption: boolean;
    platformWebhookSecret: boolean;
  };
  account: WhatsAppAccountSummary | null;
};
