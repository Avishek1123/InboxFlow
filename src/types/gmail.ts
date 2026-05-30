/**
 * Gmail integration domain types (API + UI).
 * DB shapes come from Prisma — see @/server/db after generate.
 */

export type GmailOAuthState = {
  organizationId: string;
  userId: string;
  nonce: string;
};

export type GmailConnectResponse = {
  connectedAccountId: string;
  accountEmail: string;
  status: string;
};

export type GmailSyncStats = {
  messagesFetched: number;
  messagesCreated: number;
  messagesSkipped: number;
  attachmentsStored: number;
  attachmentsFailed: number;
};

export type GmailFilterPresetId =
  | "INBOX"
  | "STARRED"
  | "IMPORTANT"
  | "UNREAD"
  | "SENT"
  | "PERSONAL"
  | "PROMOTIONS"
  | "SOCIAL"
  | "UPDATES";

export type GmailFilterMode = "any" | "all";

export type GmailTriggerSettings = {
  filterIds: GmailFilterPresetId[];
  mode: GmailFilterMode;
};

export type GmailAccountSummary = {
  id: string;
  accountEmail: string;
  status: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  syncError: string | null;
  triggerFilters: GmailTriggerSettings;
};
