import type { GmailTriggerSettings } from "@/types/gmail";

export type InboxMessageItem = {
  id: string;
  conversationId: string;
  channel: "GMAIL" | "WHATSAPP" | "SMS";
  fromAddress: string;
  subject: string | null;
  bodyText: string | null;
  snippet: string | null;
  receivedAt: string;
  labels: string[];
  isRead: boolean;
  hasAttachments: boolean;
  /** True when this message has at least one row in an AI data table */
  isExtracted: boolean;
  /** Names of extraction tables that include this message */
  extractedTableNames: string[];
};

export type InboxListResponse = {
  messages: InboxMessageItem[];
  total: number;
  activeFilters: GmailTriggerSettings;
  filterSummary: string;
};
