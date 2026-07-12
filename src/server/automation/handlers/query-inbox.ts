import { prisma } from "@/server/db";
import { interpolateObject } from "@/server/automation/template";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleQueryInbox(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );
  const query = String(config.query ?? "").trim().toLowerCase();
  const channel = config.channel
    ? String(config.channel).toUpperCase()
    : undefined;
  const limit = Math.min(Number(config.limit ?? 10) || 10, 50);

  const messages = await prisma.message.findMany({
    where: {
      organizationId: params.organizationId,
      ...(channel === "GMAIL" || channel === "WHATSAPP" || channel === "SMS"
        ? { channel: channel as "GMAIL" | "WHATSAPP" | "SMS" }
        : {}),
      ...(query
        ? {
            OR: [
              { subject: { contains: query, mode: "insensitive" } },
              { bodyText: { contains: query, mode: "insensitive" } },
              { fromAddress: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      fromAddress: true,
      subject: true,
      bodyText: true,
      receivedAt: true,
    },
  });

  const items = messages.map((m) => ({
    id: m.id,
    channel: m.channel,
    from: m.fromAddress,
    subject: m.subject,
    snippet: (m.bodyText ?? "").slice(0, 240),
    receivedAt: m.receivedAt.toISOString(),
  }));

  return {
    output: { count: items.length, items },
    variables: { inboxResults: items },
  };
}
