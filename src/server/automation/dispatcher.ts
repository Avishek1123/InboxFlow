import type { AutomationTriggerType } from "@prisma/client";
import {
  getTriggerSettings,
  labelIdsFromFilterIds,
  messageMatchesTriggerFilters,
  type GmailFilterPresetId,
} from "@/lib/gmail/trigger-filters";
import type { AutomationTriggerPayload, DispatchEvent } from "@/types/automation";
import { automationRepository } from "../repositories/automation.repository";
import { gmailRepository } from "../repositories/gmail.repository";
import { automationExecutor } from "./executor";

export class AutomationDispatcher {
  async dispatch(event: DispatchEvent): Promise<string[]> {
    const automations = await automationRepository.findActiveByTrigger(
      event.organizationId,
      event.triggerType
    );

    const executionIds: string[] = [];

    for (const automation of automations) {
      const matches = await this.matchesTriggerConfig(
        event.organizationId,
        automation.triggerType,
        event.payload,
        automation.graph
      );
      if (!matches) continue;

      try {
        const id = await automationExecutor.run({
          automation,
          triggerPayload: event.payload,
        });
        executionIds.push(id);
      } catch (err) {
        console.error(
          `[Automation] Failed ${automation.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    return executionIds;
  }

  private async matchesTriggerConfig(
    organizationId: string,
    triggerType: AutomationTriggerType,
    payload: AutomationTriggerPayload,
    graph: unknown
  ): Promise<boolean> {
    const g = graph as { nodes?: Array<{ data?: { kind?: string; config?: Record<string, unknown> } }> };
    const trigger = g.nodes?.find((n) => n.data?.kind === triggerType);
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
