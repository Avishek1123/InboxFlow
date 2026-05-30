import type { AiAnalyzeRequest, AiAnalyzeResponse } from "@/types/ai";
import type { ApiResponse } from "@/types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<T>;
  if ("error" in json) {
    throw new Error(json.error.message);
  }
  return json.data;
}

export const aiClient = {
  analyze(body: AiAnalyzeRequest) {
    return post<{ results: AiAnalyzeResponse[] }>(
      "/api/v1/ai/analyze",
      body
    );
  },

  summarize(body: Omit<AiAnalyzeRequest, "task" | "tasks">) {
    return post<{ result: AiAnalyzeResponse }>("/api/v1/ai/summarize", body);
  },

  extract(
    body: Omit<AiAnalyzeRequest, "task" | "tasks"> & {
      type: "lead" | "order" | "invoice" | "all";
    }
  ) {
    return post<unknown>("/api/v1/ai/extract", body);
  },

  autoReply(
    body: Omit<AiAnalyzeRequest, "task" | "tasks"> & {
      replyTone?: "professional" | "friendly" | "concise";
    }
  ) {
    return post<{ result: AiAnalyzeResponse }>("/api/v1/ai/auto-reply", body);
  },

  history(organizationId: string, limit = 50) {
    return fetch(
      `/api/v1/ai/history?organizationId=${encodeURIComponent(organizationId)}&limit=${limit}`
    ).then((r) => r.json());
  },
};
