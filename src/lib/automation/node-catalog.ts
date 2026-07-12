import {
  ACTION_DEFINITIONS,
  TRIGGER_DEFINITIONS,
  type IntegrationRequirement,
  type NodeDefinition,
} from "@/lib/automation/definitions";
import { integrationForNodeConfig } from "@/lib/automation/trigger-matching";
import type { NodeAppId } from "@/lib/automation/definitions";

export type NodeApp = {
  id: NodeAppId;
  label: string;
  description: string;
  color: string;
};

export const NODE_APPS: NodeApp[] = [
  {
    id: "gmail",
    label: "Gmail",
    description: "Email in and out",
    color: "#ea4335",
  },
  {
    id: "messages",
    label: "Messages",
    description: "WhatsApp & SMS (Meta or Twilio)",
    color: "#25d366",
  },
  {
    id: "twilio",
    label: "Twilio",
    description: "Legacy Twilio nodes",
    color: "#f22f46",
  },
  {
    id: "schedule",
    label: "Schedule",
    description: "Cron triggers",
    color: "#6366f1",
  },
  {
    id: "ai",
    label: "AI",
    description: "LLM analysis",
    color: "#8b5cf6",
  },
  {
    id: "utilities",
    label: "Utilities",
    description: "HTTP, storage, CRM",
    color: "#64748b",
  },
];

export type CatalogNode = NodeDefinition & {
  searchText: string;
};

function toCatalogNode(def: NodeDefinition): CatalogNode | null {
  if (def.hidden) return null;
  const appLabel =
    NODE_APPS.find((a) => a.id === def.app)?.label ?? def.app;
  return {
    ...def,
    searchText: [appLabel, def.label, def.description, def.kind]
      .join(" ")
      .toLowerCase(),
  };
}

export const CATALOG_TRIGGERS = TRIGGER_DEFINITIONS.map(toCatalogNode).filter(
  Boolean
) as CatalogNode[];

export const CATALOG_ACTIONS = ACTION_DEFINITIONS.map(toCatalogNode).filter(
  Boolean
) as CatalogNode[];

export function getAppForKind(kind: string): NodeAppId {
  return getDefinitionFromCatalog(kind)?.app ?? "utilities";
}

function getDefinitionFromCatalog(kind: string): CatalogNode | undefined {
  return (
    CATALOG_TRIGGERS.find((n) => n.kind === kind) ??
    CATALOG_ACTIONS.find((n) => n.kind === kind) ??
    TRIGGER_DEFINITIONS.find((d) => d.kind === kind) ??
    ACTION_DEFINITIONS.find((d) => d.kind === kind)
  ) as CatalogNode | undefined;
}

export function resolveNodeIntegration(
  def: NodeDefinition,
  config?: Record<string, unknown>
): IntegrationRequirement | undefined {
  if (def.requiredIntegration) return def.requiredIntegration;
  return integrationForNodeConfig(
    def.kind,
    config ?? def.defaultConfig
  );
}

export function filterCatalogNodes(
  nodes: CatalogNode[],
  query: string
): CatalogNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.filter((n) => n.searchText.includes(q));
}

export function catalogNodesByApp(nodes: CatalogNode[]): Map<NodeAppId, CatalogNode[]> {
  const map = new Map<NodeAppId, CatalogNode[]>();
  for (const node of nodes) {
    const list = map.get(node.app) ?? [];
    list.push(node);
    map.set(node.app, list);
  }
  return map;
}
