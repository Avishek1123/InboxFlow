import type { ApiResponse } from "@/types";
import type { InboxListResponse } from "@/types/inbox";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const json = (await res.json()) as ApiResponse<T>;
  if ("error" in json) throw new Error(json.error.message);
  return json.data;
}

export const inboxClient = {
  list(channel?: "GMAIL" | "WHATSAPP") {
    const q = channel ? `?channel=${channel}` : "";
    return request<InboxListResponse>(`/api/v1/inbox${q}`);
  },
};
