import type { Automation, Prisma } from "@prisma/client";
import type {
  AutomationTriggerPayload,
  ExecutionContext,
  WorkflowGraph,
} from "@/types/automation";
import { getExecutionOrder, validateGraph } from "./graph";
import { executeAction } from "./handlers";
import { AutomationEngineError } from "./errors";
import { automationExecutionRepository } from "../repositories/automation-execution.repository";
import { automationRepository } from "../repositories/automation.repository";
import { computeNextRetryAt, shouldRetry } from "./retry";

export class AutomationExecutor {
  async run(params: {
    automation: Automation;
    triggerPayload: AutomationTriggerPayload;
    executionId?: string;
  }): Promise<string> {
    const graph = params.automation.graph as unknown as WorkflowGraph;
    const { valid, errors, triggerNode } = validateGraph(graph);

    if (!valid || !triggerNode) {
      throw new AutomationEngineError("INVALID_GRAPH", errors.join("; "));
    }

    let executionId = params.executionId;

    if (!executionId) {
      const execution = await automationExecutionRepository.create({
        organizationId: params.automation.organizationId,
        automationId: params.automation.id,
        triggerType: params.automation.triggerType,
        triggerPayload: params.triggerPayload as Prisma.InputJsonValue,
      });
      executionId = execution.id;
    } else {
      await automationExecutionRepository.markRunning(executionId);
    }

    const context: ExecutionContext = {
      trigger: params.triggerPayload,
      variables: {},
    };

    try {
      const actionNodes = getExecutionOrder(graph, triggerNode.id);

      for (const node of actionNodes) {
        const step = await automationExecutionRepository.createStep({
          executionId,
          nodeId: node.id,
          nodeType: node.data.kind,
          label: node.data.label,
        });

        const stepStart = Date.now();
        await automationExecutionRepository.updateStep(step.id, {
          status: "RUNNING",
        });

        try {
          const result = await executeAction({
            organizationId: params.automation.organizationId,
            automationId: params.automation.id,
            executionId,
            node: node.data,
            context,
          });

          context.lastOutput = result.output;
          if (result.variables) {
            context.variables = { ...context.variables, ...result.variables };
          }

          await automationExecutionRepository.updateStep(step.id, {
            status: "COMPLETED",
            output: result.output as Prisma.InputJsonValue,
            latencyMs: Date.now() - stepStart,
          });
        } catch (stepErr) {
          const msg =
            stepErr instanceof Error ? stepErr.message : "Step failed";
          await automationExecutionRepository.updateStep(step.id, {
            status: "FAILED",
            errorMessage: msg,
            latencyMs: Date.now() - stepStart,
          });
          throw stepErr;
        }
      }

      await automationExecutionRepository.markCompleted(executionId, context);
      await automationRepository.incrementRunCount(
        params.automation.id,
        true
      );

      return executionId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Execution failed";
      const execution = await automationExecutionRepository.findById(
        executionId
      );

      if (
        execution &&
        shouldRetry(execution.retryCount, execution.maxRetries)
      ) {
        await automationExecutionRepository.scheduleRetry(
          executionId,
          execution.retryCount + 1,
          computeNextRetryAt(execution.retryCount),
          message
        );
      } else {
        await automationExecutionRepository.markFailed(executionId, message);
        await automationRepository.incrementRunCount(
          params.automation.id,
          false,
          message
        );
      }
      throw err;
    }
  }

  async retryExecution(executionId: string): Promise<string> {
    const execution = await automationExecutionRepository.findById(executionId);
    if (!execution) {
      throw new AutomationEngineError("NOT_FOUND", "Execution not found", 404);
    }

    const automation = await automationRepository.findById(
      execution.automationId
    );
    if (!automation) {
      throw new AutomationEngineError("NOT_FOUND", "Automation not found", 404);
    }

    return this.run({
      automation,
      triggerPayload: execution.triggerPayload as AutomationTriggerPayload,
      executionId,
    });
  }
}

export const automationExecutor = new AutomationExecutor();
