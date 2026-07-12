import type { WhatsAppConnectInput, WhatsAppStatusResponse } from "@/types/whatsapp";
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

export const whatsappClient = {
  getStatus() {
    return request<WhatsAppStatusResponse>(
      "/api/v1/integrations/whatsapp/status"
    );
  },

  connect(credentials: WhatsAppConnectInput) {
    return request<{
      connectedAccountId: string;
      account: WhatsAppStatusResponse["account"];
    }>("/api/v1/integrations/whatsapp/connect", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  disconnect() {
    return request<{ disconnected: boolean }>(
      "/api/v1/integrations/whatsapp/disconnect",
      { method: "POST" }
    );
  },

  clearSyncedData() {
    return request<{ deletedMessages: number }>(
      "/api/v1/integrations/whatsapp/clear-data",
      { method: "POST" }
    );
  },

  sendPending() {
    return request<{ results: unknown[] }>(
      "/api/v1/integrations/whatsapp/send-pending",
      { method: "POST" }
    );
  },
};
