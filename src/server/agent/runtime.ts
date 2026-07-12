import { prisma } from "@/server/db";
import { completeWithFallback } from "@/server/ai/router";
import { extractJsonFromResponse } from "@/server/ai/utils";
import type { ExecutionContext } from "@/types/automation";
import { ensureToolsRegistered } from "./tools/register-all";
import { getTool, getToolCatalogForPrompt } from "./tool-registry";
import { estimateCostUsd } from "./pricing";
import { recordAiUsage } from "./usage";
import { buildMemoryPack } from "./memory";

export type AgentLoopResult = {
  agentRunId: string;
  output: unknown;
  variables: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

type AgentDecision =
  | { type: "tool"; tool: string; args: Record<string, unknown> }
  | { type: "final"; result: unknown };

function parseDecision(raw: string): AgentDecision {
  const jsonStr = extractJsonFromResponse(raw);
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  if (parsed.tool && typeof parsed.tool === "string") {
    return {
      type: "tool",
      tool: parsed.tool,
      args:
        typeof parsed.args === "object" && parsed.args
          ? (parsed.args as Record<string, unknown>)
          : {},
    };
  }
  if ("final" in parsed) {
    return { type: "final", result: parsed.final };
  }
  if ("result" in parsed) {
    return { type: "final", result: parsed.result };
  }
  return { type: "final", result: parsed };
}

export async function runAgentLoop(params: {
  organizationId: string;
  automationId: string;
  executionId: string;
  goal: string;
  context: ExecutionContext;
  maxSteps?: number;
  allowSendTools?: boolean;
}): Promise<AgentLoopResult> {
  ensureToolsRegistered();

  const maxSteps = Math.min(Math.max(params.maxSteps ?? 6, 1), 12);
  const memory = await buildMemoryPack({
    organizationId: params.organizationId,
    context: params.context,
  });

  const agentRun = await prisma.agentRun.create({
    data: {
      organizationId: params.organizationId,
      automationExecutionId: params.executionId,
      goal: params.goal,
      status: "RUNNING",
    },
  });

  const catalog = getToolCatalogForPrompt({
    includeSend: params.allowSendTools === true,
  });

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `You are an InboxFlow workspace agent. Achieve the goal using tools.
Return ONLY valid JSON in one of these shapes:
{"tool":"tool.name","args":{...}}
{"final":{...}}

Available tools:
${catalog}

Rules:
- Prefer read tools before write/send.
- Do not invent IDs; use values from observations or trigger.
- Stop with {"final":...} when the goal is done or blocked.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        goal: params.goal,
        trigger: params.context.trigger,
        variables: params.context.variables,
        memory,
      }),
    },
  ];

  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCostUsd = 0;
  let finalOutput: unknown = { ok: true };
  const variables: Record<string, unknown> = {};

  try {
    for (let step = 0; step < maxSteps; step++) {
      const completion = await completeWithFallback({
        messages,
        temperature: 0.1,
        maxTokens: 1200,
        jsonMode: true,
      });

      inputTokens += completion.inputTokens ?? 0;
      outputTokens += completion.outputTokens ?? 0;
      const stepCost = estimateCostUsd({
        model: completion.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
      });
      estimatedCostUsd += stepCost;

      await recordAiUsage({
        organizationId: params.organizationId,
        provider: completion.provider,
        model: completion.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
      });

      messages.push({ role: "assistant", content: completion.content });

      let decision: AgentDecision;
      try {
        decision = parseDecision(completion.content);
      } catch {
        decision = { type: "final", result: { raw: completion.content } };
      }

      if (decision.type === "final") {
        finalOutput = decision.result;
        break;
      }

      const tool = getTool(decision.tool);
      const toolCall = await prisma.agentToolCall.create({
        data: {
          agentRunId: agentRun.id,
          toolName: decision.tool,
          input: decision.args as object,
          status: "RUNNING",
        },
      });

      const started = Date.now();
      try {
        if (!tool) {
          throw new Error(`Unknown tool: ${decision.tool}`);
        }
        if (tool.sideEffect === "send" && !params.allowSendTools) {
          throw new Error(
            `Send tool ${tool.name} blocked. Enable allowSendTools or use approval.`
          );
        }

        const result = await tool.execute({
          organizationId: params.organizationId,
          automationId: params.automationId,
          executionId: params.executionId,
          node: {
            kind: (tool.actionKind as never) ?? "STORE_DATA",
            label: tool.name,
            config: decision.args,
          },
          context: params.context,
        });

        if (result.variables) {
          Object.assign(variables, result.variables);
          params.context.variables = {
            ...params.context.variables,
            ...result.variables,
          };
        }
        params.context.lastOutput = result.output;

        await prisma.agentToolCall.update({
          where: { id: toolCall.id },
          data: {
            status: "COMPLETED",
            output: result.output as object,
            latencyMs: Date.now() - started,
          },
        });

        messages.push({
          role: "user",
          content: JSON.stringify({
            observation: {
              tool: decision.tool,
              ok: true,
              output: result.output,
            },
          }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Tool failed";
        await prisma.agentToolCall.update({
          where: { id: toolCall.id },
          data: {
            status: "FAILED",
            errorMessage: message,
            latencyMs: Date.now() - started,
            output: { error: message },
          },
        });
        messages.push({
          role: "user",
          content: JSON.stringify({
            observation: { tool: decision.tool, ok: false, error: message },
          }),
        });
      }
    }

    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "COMPLETED",
        result: finalOutput as object,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        completedAt: new Date(),
      },
    });

    return {
      agentRunId: agentRun.id,
      output: finalOutput,
      variables: { ...variables, agentRunId: agentRun.id },
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent failed";
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        inputTokens,
        outputTokens,
        estimatedCostUsd,
        completedAt: new Date(),
      },
    });
    throw err;
  }
}
