import type { IntegrationRequirement, NodeDefinition } from "@/lib/automation/definitions";
import { ALL_DEFINITIONS } from "@/lib/automation/definitions";
import { resolveNodeIntegration } from "@/lib/automation/node-catalog";
import { resolveStoredTriggerType } from "@/lib/automation/trigger-matching";
import type { WorkflowGraph } from "@/types/automation";

export function getRequiredIntegration(
  kind: string,
  config?: Record<string, unknown>
): IntegrationRequirement | undefined {
  const def = ALL_DEFINITIONS.find((d) => d.kind === kind);
  if (!def) return undefined;
  return resolveNodeIntegration(def, config);
}

export function missingIntegrationsForGraph(
  graph: WorkflowGraph,
  isConnected: (req: IntegrationRequirement) => boolean
): IntegrationRequirement[] {
  const missing = new Set<IntegrationRequirement>();
  for (const node of graph.nodes) {
    const req = getRequiredIntegration(node.data.kind, node.data.config);
    if (req && !isConnected(req)) missing.add(req);
  }
  return [...missing];
}

export function integrationLabel(req: IntegrationRequirement): string {
  if (req === "GMAIL") return "Gmail";
  if (req === "TWILIO") return "Twilio";
  return "WhatsApp";
}

export type PendingNodeAdd = {
  def: NodeDefinition;
  position?: { x: number; y: number };
};

export { resolveStoredTriggerType };
