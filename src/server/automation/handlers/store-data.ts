import { prisma } from "@/server/db";
import { interpolate } from "../template";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleStoreData(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = params.node.config as Record<string, unknown>;
  const key = String(config.key ?? "data");
  const valueTemplate = String(
    config.valueTemplate ?? "{{lastOutput}}"
  );

  let value: unknown;
  try {
    const parsed = JSON.parse(interpolate(valueTemplate, params.context));
    value = parsed;
  } catch {
    value = interpolate(valueTemplate, params.context);
  }

  const record = await prisma.automationDataRecord.create({
    data: {
      organizationId: params.organizationId,
      automationId: params.automationId,
      executionId: params.executionId,
      key,
      value: value as object,
    },
  });

  return {
    output: record,
    variables: { [key]: value },
  };
}
