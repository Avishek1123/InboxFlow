import type { GmailAccountSummary, GmailTriggerSettings } from "@/types/gmail";
import type { ApiResponse } from "@/types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if ("error" in json) throw new Error(json.error.message);
  return json.data;
}

export const gmailClient = {
  getStatus() {
    return request<{
      configured: { google: boolean; encryption: boolean };
      account: GmailAccountSummary | null;
      sheetsScopesGranted: boolean;
      oauthProjectMismatch: boolean;
      legacyOAuthToken: boolean;
      legacyOAuthProject: string | null;
      refreshTokenInvalid: boolean;
      needsReconnect?: boolean;
      reconnectMessage: string | null;
      reconnectUrl: string;
    }>("/api/v1/integrations/gmail/status");
  },

  sync() {
    return request<{
      stats: {
        messagesFetched: number;
        messagesCreated: number;
        messagesSkipped: number;
      };
      newMessageIds: string[];
      pipelineRan: boolean;
    }>("/api/v1/integrations/gmail/sync", { method: "POST" });
  },

  disconnect() {
    return request<{ disconnected: boolean }>(
      "/api/v1/integrations/gmail/disconnect",
      { method: "POST" }
    );
  },

  clearSyncedData() {
    return request<{ deletedMessages: number }>(
      "/api/v1/integrations/gmail/clear-data",
      { method: "POST" }
    );
  },

  updateTriggers(settings: GmailTriggerSettings) {
    return request<{ triggerFilters: GmailTriggerSettings }>(
      "/api/v1/integrations/gmail/triggers",
      {
        method: "PATCH",
        body: JSON.stringify(settings),
      }
    );
  },

  connectUrl: "/api/v1/integrations/gmail/connect",
  reconnectUrl: "/api/v1/integrations/gmail/connect?reconnect=1",
};
