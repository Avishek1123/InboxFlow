import type { WorkflowGraph } from "@/types/automation";
import type { ApiResponse } from "@/types";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if ("error" in json) throw new Error(json.error.message);
  return json.data;
}

export const automationClient = {
  list(organizationId: string) {
    return request<{ items: unknown[] }>(
      `/api/v1/automations?organizationId=${encodeURIComponent(organizationId)}`
    );
  },

  get(id: string) {
    return request<{ item: unknown }>(`/api/v1/automations/${id}`);
  },

  create(body: {
    organizationId: string;
    name: string;
    description?: string;
    triggerType: string;
    graph: WorkflowGraph;
    cronExpression?: string;
  }) {
    return request<{ item: { id: string } }>("/api/v1/automations", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  update(id: string, body: Record<string, unknown>) {
    return request<{ item: unknown }>(`/api/v1/automations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  activate(id: string) {
    return request<{ item: unknown }>(
      `/api/v1/automations/${id}/activate`,
      { method: "POST" }
    );
  },

  execute(id: string, payload?: Record<string, unknown>) {
    return request<{ executionId: string }>(
      `/api/v1/automations/${id}/execute`,
      {
        method: "POST",
        body: JSON.stringify({ payload }),
      }
    );
  },

  executions(id: string) {
    return request<{ items: unknown[] }>(
      `/api/v1/automations/${id}/executions`
    );
  },

  monitoring(organizationId: string) {
    return request<{ stats: unknown }>(
      `/api/v1/automations/monitoring?organizationId=${encodeURIComponent(organizationId)}`
    );
  },

  definitions() {
    return request<{ triggers: unknown[]; actions: unknown[] }>(
      "/api/v1/automations/definitions"
    );
  },

  delete(id: string) {
    return request<{ deleted: boolean }>(`/api/v1/automations/${id}`, {
      method: "DELETE",
    });
  },
};
