import type { Automation, AutomationTriggerType, Prisma } from "@prisma/client";
import type {
  AutomationTriggerPayload,
  ExecutionContext,
  WorkflowGraph,
} from "@/types/automation";
import {
  findTriggerNodesByKind,
  getExecutionOrder,
  getTriggerNodes,
  validateGraph,
} from "./graph";
import { ApprovalRequiredError, executeAction } from "./handlers";
import { AutomationEngineError } from "./errors";
import { automationExecutionRepository } from "../repositories/automation-execution.repository";
import { automationRepository } from "../repositories/automation.repository";
import { computeNextRetryAt, shouldRetry } from "./retry";

export class AutomationExecutor {
  async run(params: {
    automation: Automation;
    triggerPayload: AutomationTriggerPayload;
    executionId?: string;
    triggerNodeId?: string;
    triggerType?: AutomationTriggerType;
  }): Promise<string> {
    const graph = params.automation.graph as unknown as WorkflowGraph;
    const { valid, errors } = validateGraph(graph);

    if (!valid) {
      throw new AutomationEngineError("INVALID_GRAPH", errors.join("; "));
    }

    const triggerNode = params.triggerNodeId
      ? graph.nodes.find((n) => n.id === params.triggerNodeId)
      : findTriggerNodesByKind(
          graph,
          params.triggerType ?? params.automation.triggerType
        )[0] ?? getTriggerNodes(graph)[0];

    if (!triggerNode) {
      throw new AutomationEngineError(
        "INVALID_GRAPH",
        "No matching trigger node for this event"
      );
    }

    const executionTriggerType =
      params.triggerType ??
      (triggerNode.data.kind as AutomationTriggerType);

    let executionId = params.executionId;

    if (!executionId) {
      const execution = await automationExecutionRepository.create({
        organizationId: params.automation.organizationId,
        automationId: params.automation.id,
        triggerType: executionTriggerType,
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
        if (context.variables.__skipRemaining === true) {
          const step = await automationExecutionRepository.createStep({
            executionId,
            nodeId: node.id,
            nodeType: node.data.kind,
            label: node.data.label,
          });
          await automationExecutionRepository.updateStep(step.id, {
            status: "SKIPPED",
            output: { reason: "Skipped by prior condition" },
          });
          continue;
        }

        const onlyIf = node.data.config?.onlyIf;
        if (onlyIf !== undefined && onlyIf !== null && onlyIf !== "") {
          const flag = Boolean(context.variables[String(onlyIf)]);
          if (!flag) {
            const step = await automationExecutionRepository.createStep({
              executionId,
              nodeId: node.id,
              nodeType: node.data.kind,
              label: node.data.label,
            });
            await automationExecutionRepository.updateStep(step.id, {
              status: "SKIPPED",
              output: { reason: `onlyIf ${String(onlyIf)} was false` },
            });
            continue;
          }
        }

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
          if (stepErr instanceof ApprovalRequiredError) {
            await automationExecutionRepository.updateStep(step.id, {
              status: "COMPLETED",
              output: {
                approvalId: stepErr.approvalId,
                waiting: true,
                summary: stepErr.summary,
              } as Prisma.InputJsonValue,
              latencyMs: Date.now() - stepStart,
            });
            await automationExecutionRepository.markWaitingApproval(
              executionId,
              context,
              stepErr.message
            );
            return executionId;
          }

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
      if (err instanceof ApprovalRequiredError) {
        return executionId;
      }

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
