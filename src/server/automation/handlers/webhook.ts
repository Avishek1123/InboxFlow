import { interpolate, interpolateObject } from "../template";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleWebhookRequest(
  params: HandlerParams
): Promise<HandlerResult> {
  const rawConfig = params.node.config as Record<string, unknown>;
  const url = interpolate(String(rawConfig.url ?? ""), params.context);
  const method = String(rawConfig.method ?? "POST").toUpperCase();

  let body: string;
  if (rawConfig.bodyTemplate) {
    body = interpolate(String(rawConfig.bodyTemplate), params.context);
  } else {
    body = JSON.stringify(params.context.trigger);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(rawConfig.headers as Record<string, string>),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: method !== "GET" ? body : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let responseBody: unknown = text;
    try {
      responseBody = JSON.parse(text);
    } catch {
      /* keep text */
    }

    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}: ${text.slice(0, 300)}`);
    }

    return {
      output: { status: res.status, body: responseBody },
      variables: { webhookResponse: responseBody },
    };
  } finally {
    clearTimeout(timeout);
  }
}
