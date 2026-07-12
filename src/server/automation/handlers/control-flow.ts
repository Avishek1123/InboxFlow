import { prisma } from "@/server/db";
import { interpolateObject } from "@/server/automation/template";
import type { HandlerParams, HandlerResult } from "./index";
import type { Prisma } from "@prisma/client";

export class ApprovalRequiredError extends Error {
  constructor(
    public readonly approvalId: string,
    public readonly summary: string
  ) {
    super(`Waiting for approval: ${summary}`);
    this.name = "ApprovalRequiredError";
  }
}

export async function handleRequestApproval(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );
  const summary =
    String(config.summary ?? "").trim() ||
    "Agent action requires your approval";

  const approval = await prisma.approvalRequest.create({
    data: {
      organizationId: params.organizationId,
      executionId: params.executionId,
      status: "PENDING",
      summary,
      payload: {
        automationId: params.automationId,
        trigger: params.context.trigger,
        variables: params.context.variables,
        lastOutput: params.context.lastOutput ?? null,
        resumeAction: config.resumeAction ?? null,
      } as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  throw new ApprovalRequiredError(approval.id, summary);
}

export async function handleCondition(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );

  const left = config.left ?? config.field;
  const op = String(config.operator ?? "equals");
  const right = config.right ?? config.value;

  let met = false;
  const leftStr = left === undefined || left === null ? "" : String(left);
  const rightStr = right === undefined || right === null ? "" : String(right);
  const leftNum = Number(left);
  const rightNum = Number(right);

  switch (op) {
    case "equals":
      met = leftStr === rightStr;
      break;
    case "not_equals":
      met = leftStr !== rightStr;
      break;
    case "contains":
      met = leftStr.toLowerCase().includes(rightStr.toLowerCase());
      break;
    case "gt":
      met = leftNum > rightNum;
      break;
    case "gte":
      met = leftNum >= rightNum;
      break;
    case "lt":
      met = leftNum < rightNum;
      break;
    case "lte":
      met = leftNum <= rightNum;
      break;
    case "truthy":
      met = Boolean(left) && leftStr !== "false" && leftStr !== "0";
      break;
    default:
      met = leftStr === rightStr;
  }

  return {
    output: { met, left, operator: op, right },
    variables: {
      conditionMet: met,
      __skipRemaining: config.skipWhenFalse === false ? false : !met,
    },
  };
}

export async function handleWait(params: HandlerParams): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );
  const seconds = Math.min(Math.max(Number(config.seconds ?? 1) || 1, 0), 30);
  await new Promise((r) => setTimeout(r, seconds * 1000));
  return {
    output: { waitedSeconds: seconds },
    variables: { lastWaitSeconds: seconds },
  };
}
