import type { HandlerParams, HandlerResult } from "@/server/automation/handlers";

export type ToolSideEffect = "read" | "write" | "send";

export type ToolDefinition = {
  name: string;
  description: string;
  /** Maps to workflow action kind when used as a fixed node */
  actionKind?: string;
  sideEffect: ToolSideEffect;
  requiresApproval?: boolean;
  inputSchema: Record<string, unknown>;
  execute: (params: HandlerParams) => Promise<HandlerResult>;
};

const registry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition) {
  registry.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function listTools(options?: {
  sideEffect?: ToolSideEffect | ToolSideEffect[];
}): ToolDefinition[] {
  const all = [...registry.values()];
  if (!options?.sideEffect) return all;
  const allowed = new Set(
    Array.isArray(options.sideEffect) ? options.sideEffect : [options.sideEffect]
  );
  return all.filter((t) => allowed.has(t.sideEffect));
}

export function getToolCatalogForPrompt(options?: {
  includeSend?: boolean;
}): string {
  const tools = listTools().filter(
    (t) => options?.includeSend || t.sideEffect !== "send"
  );
  return tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  input: ${JSON.stringify(t.inputSchema)}`
    )
    .join("\n");
}
