import { prisma } from "@/server/db";
import { interpolateObject } from "@/server/automation/template";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleMemorySet(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );
  const key = String(config.key ?? "").trim();
  const value = String(config.value ?? config.valueTemplate ?? "").trim();
  const contactId = String(config.contactId ?? "").trim() || null;

  if (!key || !value) {
    return { output: { ok: false, error: "key and value required" } };
  }

  const fact = await prisma.customerMemoryFact.create({
    data: {
      organizationId: params.organizationId,
      contactId,
      key,
      value,
      source: "agent",
      confidence: Number(config.confidence ?? 1) || 1,
    },
  });

  return {
    output: fact,
    variables: { lastMemoryFactId: fact.id, [`memory_${key}`]: value },
  };
}
