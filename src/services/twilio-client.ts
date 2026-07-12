import type { TwilioConnectInput, TwilioStatusResponse } from "@/types/twilio";
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

export const twilioClient = {
  getStatus() {
    return request<TwilioStatusResponse>("/api/v1/integrations/twilio/status");
  },

  connect(credentials: TwilioConnectInput) {
    return request<{
      connectedAccountId: string;
      account: TwilioStatusResponse["account"];
    }>("/api/v1/integrations/twilio/connect", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  disconnect() {
    return request<{ disconnected: boolean }>(
      "/api/v1/integrations/twilio/disconnect",
      { method: "POST" }
    );
  },
};
