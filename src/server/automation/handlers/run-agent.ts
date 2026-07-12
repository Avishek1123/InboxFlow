import { interpolate } from "@/server/automation/template";
import { runAgentLoop } from "@/server/agent/runtime";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleRunAgent(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = params.node.config as Record<string, unknown>;
  const goalTemplate = String(
    config.goal ??
      "Process this inbound message: extract useful fields, update tables/sheets if linked, and summarize next steps."
  );
  const goal = interpolate(goalTemplate, params.context);
  const maxSteps = Number(config.maxSteps ?? 6) || 6;
  const allowSendTools = config.allowSendTools === true;

  const result = await runAgentLoop({
    organizationId: params.organizationId,
    automationId: params.automationId,
    executionId: params.executionId,
    goal,
    context: params.context,
    maxSteps,
    allowSendTools,
  });

  return {
    output: {
      agentRunId: result.agentRunId,
      result: result.output,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
    },
    variables: result.variables,
  };
}
