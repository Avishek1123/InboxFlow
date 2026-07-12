import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { prisma } from "@/server/db";
import { completeWithFallback } from "@/server/ai/router";
import { extractJsonFromResponse } from "@/server/ai/utils";
import { buildMemoryPack } from "@/server/agent/memory";
import { getTool, getToolCatalogForPrompt, ensureToolsRegistered } from "@/server/agent";
import { recordAiUsage } from "@/server/agent/usage";
import type { ExecutionContext } from "@/types/automation";

export const runtime = "nodejs";

// re-export ensure - need to export from index
import { ensureToolsRegistered as ensure } from "@/server/agent/tools/register-all";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  threadId: z.string().optional(),
  confirmToolCall: z
    .object({
      tool: z.string(),
      args: z.record(z.string(), z.unknown()),
    })
    .optional(),
});

export async function GET() {
  const { organization } = await requireOrganization();
  const threads = await prisma.chatThread.findMany({
    where: { organizationId: organization.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return apiSuccess({ threads });
}

export async function POST(request: Request) {
  try {
    ensure();
    const { organization } = await requireOrganization();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
    }

    let thread = parsed.data.threadId
      ? await prisma.chatThread.findFirst({
          where: {
            id: parsed.data.threadId,
            organizationId: organization.id,
          },
        })
      : null;

    if (!thread) {
      thread = await prisma.chatThread.create({
        data: {
          organizationId: organization.id,
          title: parsed.data.message.slice(0, 60),
        },
      });
    }

    await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "user",
        content: parsed.data.message,
      },
    });

    const context: ExecutionContext = {
      trigger: { body: parsed.data.message, channel: "GMAIL" },
      variables: {},
    };
    const memory = await buildMemoryPack({
      organizationId: organization.id,
      context,
    });

    const recent = await prisma.message.findMany({
      where: { organizationId: organization.id },
      orderBy: { receivedAt: "desc" },
      take: 8,
      select: {
        id: true,
        channel: true,
        fromAddress: true,
        subject: true,
        bodyText: true,
      },
    });

    const tables = await prisma.extractionTable.findMany({
      where: { organizationId: organization.id },
      take: 10,
      select: { id: true, name: true },
    });

    const executions = await prisma.automationExecution.findMany({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { automation: { select: { name: true } } },
    });

    const catalog = getToolCatalogForPrompt({ includeSend: false });

    const completion = await completeWithFallback({
      messages: [
        {
          role: "system",
          content: `You are InboxFlow Workspace Chat. Answer using workspace context.
For actions, return JSON {"tool":"name","args":{...}} using ONLY read/write tools (no send).
For answers, return JSON {"answer":"markdown","citations":[{"type":"message|table|execution","id":"..."}]}.

Tools:
${catalog}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            question: parsed.data.message,
            memory,
            recentMessages: recent.map((m) => ({
              id: m.id,
              channel: m.channel,
              from: m.fromAddress,
              subject: m.subject,
              snippet: (m.bodyText ?? "").slice(0, 180),
            })),
            tables,
            recentExecutions: executions.map((e) => ({
              id: e.id,
              automation: e.automation.name,
              status: e.status,
              error: e.errorMessage,
              startedAt: e.startedAt,
            })),
            confirmedTool: parsed.data.confirmToolCall ?? null,
          }),
        },
      ],
      temperature: 0.2,
      maxTokens: 1500,
      jsonMode: true,
    });

    await recordAiUsage({
      organizationId: organization.id,
      provider: completion.provider,
      model: completion.model,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
    });

    let replyText = completion.content;
    let citations: unknown = null;
    let toolResult: unknown = null;

    try {
      const json = JSON.parse(
        extractJsonFromResponse(completion.content)
      ) as Record<string, unknown>;

      if (typeof json.tool === "string") {
        const tool = getTool(json.tool);
        if (!tool) {
          replyText = `I wanted to call \`${json.tool}\` but that tool is not available.`;
        } else if (tool.sideEffect === "send") {
          replyText = `I won't send messages from chat without an automation approval flow. Tool \`${tool.name}\` is blocked here.`;
        } else {
          const args =
            typeof json.args === "object" && json.args
              ? (json.args as Record<string, unknown>)
              : {};
          const result = await tool.execute({
            organizationId: organization.id,
            automationId: "workspace-chat",
            executionId: `chat_${thread.id}`,
            node: {
              kind: (tool.actionKind as never) ?? "QUERY_INBOX",
              label: tool.name,
              config: args,
            },
            context,
          });
          toolResult = result.output;
          replyText = `Used **${tool.name}**:\n\n\`\`\`json\n${JSON.stringify(result.output, null, 2).slice(0, 3500)}\n\`\`\``;
        }
      } else if (typeof json.answer === "string") {
        replyText = json.answer;
        citations = json.citations ?? null;
      }
    } catch {
      // keep raw content
    }

    const saved = await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "assistant",
        content: replyText,
        citations: citations as object | undefined,
      },
    });

    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    const messages = await prisma.chatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return apiSuccess({
      thread,
      message: saved,
      messages,
      toolResult,
    });
  } catch (err) {
    console.error("[agent/chat]", err);
    return apiError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "Chat failed",
      500
    );
  }
}
