import type { ExecutionContext } from "@/types/automation";

export function interpolate(
  template: string,
  ctx: ExecutionContext
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const value = resolvePath(path.trim(), ctx);
    if (value === undefined || value === null) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

export function interpolateObject(
  obj: Record<string, unknown>,
  ctx: ExecutionContext
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      out[k] = interpolate(v, ctx);
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = interpolateObject(v as Record<string, unknown>, ctx);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function resolvePath(path: string, ctx: ExecutionContext): unknown {
  const parts = path.split(".");
  let current: unknown = ctx;
  if (parts[0] === "trigger") {
    current = ctx.trigger;
    parts.shift();
  } else if (parts[0] === "variables") {
    current = ctx.variables;
    parts.shift();
  } else if (parts[0] === "lastOutput") {
    return ctx.lastOutput;
  }

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
