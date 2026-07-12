import type { AutomationTriggerType } from "@prisma/client";
import {
  getTriggerSettings,
  labelIdsFromFilterIds,
  messageMatchesTriggerFilters,
  type GmailFilterPresetId,
} from "@/lib/gmail/trigger-filters";
import type {
  AutomationTriggerPayload,
  DispatchEvent,
  WorkflowGraph,
} from "@/types/automation";
import { findTriggerNodesByKind } from "@/server/automation/graph";
import { automationRepository } from "@/server/repositories/automation.repository";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import { automationExecutor } from "./executor";

export class AutomationDispatcher {
  async dispatch(event: DispatchEvent): Promise<string[]> {
    const automations = await automationRepository.findActiveForOrganization(
      event.organizationId
    );

    const executionIds: string[] = [];

    for (const automation of automations) {
      const graph = automation.graph as unknown as WorkflowGraph;
      const triggerNodes = findTriggerNodesByKind(graph, event.triggerType);

      for (const triggerNode of triggerNodes) {
        const matches = await this.matchesTriggerConfig(
          event.organizationId,
          event.triggerType,
          event.payload,
          triggerNode
        );
        if (!matches) continue;

        try {
          const id = await automationExecutor.run({
            automation,
            triggerPayload: event.payload,
            triggerNodeId: triggerNode.id,
            triggerType: event.triggerType,
          });
          executionIds.push(id);
        } catch (err) {
          console.error(
            `[Automation] Failed ${automation.id} (trigger ${triggerNode.id}):`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    return executionIds;
  }

  private async matchesTriggerConfig(
    organizationId: string,
    triggerType: AutomationTriggerType,
    payload: AutomationTriggerPayload,
    trigger: { data?: { kind?: string; config?: Record<string, unknown> } }
  ): Promise<boolean> {
    if (!trigger?.data?.config) return true;

    const config = trigger.data.config;

    if (triggerType === "AI_EXTRACTION_COMPLETED") {
      const allowed = config.taskTypes as string[] | undefined;
      const taskType = payload.taskType as string | undefined;
      if (allowed?.length && taskType && !allowed.includes(taskType)) {
        return false;
      }
    }

    if (triggerType === "NEW_GMAIL_EMAIL") {
      const msgLabels = (payload.labels as string[] | undefined) ?? [];
      const workflowLabels = config.filterLabels as string[] | undefined;
      const workflowPresetIds = config.filterPresetIds as
        | GmailFilterPresetId[]
        | undefined;

      let effectiveLabelIds: string[] = [];
      if (workflowPresetIds?.length) {
        effectiveLabelIds = labelIdsFromFilterIds(workflowPresetIds);
      } else if (workflowLabels?.length) {
        effectiveLabelIds = workflowLabels;
      } else {
        const account = await gmailRepository.findGmailAccount(organizationId);
        if (account) {
          const settings = getTriggerSettings(account.metadata);
          if (!messageMatchesTriggerFilters(msgLabels, settings)) {
            return false;
          }
          return true;
        }
      }

      if (effectiveLabelIds.length > 0) {
        const mode =
          (config.filterMode as "any" | "all" | undefined) ?? "any";
        if (mode === "all") {
          if (!effectiveLabelIds.every((l) => msgLabels.includes(l))) {
            return false;
          }
        } else if (!effectiveLabelIds.some((l) => msgLabels.includes(l))) {
          return false;
        }
      }
    }

    return true;
  }
}

export const automationDispatcher = new AutomationDispatcher();
