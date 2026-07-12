import { prisma } from "@/server/db";
import type { ExecutionContext } from "@/types/automation";

export type MemoryPack = {
  conversationSummary: string | null;
  customerFacts: Array<{ key: string; value: string }>;
  recentMessages: Array<{
    id: string;
    channel: string;
    from: string;
    subject: string | null;
    snippet: string;
  }>;
};

export async function buildMemoryPack(params: {
  organizationId: string;
  context: ExecutionContext;
}): Promise<MemoryPack> {
  const conversationId = params.context.trigger.conversationId;
  const from = params.context.trigger.from;

  const conversationSummary = conversationId
    ? (
        await prisma.conversationMemory.findUnique({
          where: { conversationId },
        })
      )?.summaryText ?? null
    : null;

  const contact = from
    ? await prisma.contact.findFirst({
        where: {
          organizationId: params.organizationId,
          OR: [{ email: from }, { phone: from }],
        },
      })
    : null;

  const customerFacts = await prisma.customerMemoryFact.findMany({
    where: {
      organizationId: params.organizationId,
      ...(contact ? { contactId: contact.id } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const recentMessages = await prisma.message.findMany({
    where: {
      organizationId: params.organizationId,
      ...(conversationId ? { conversationId } : from ? { fromAddress: from } : {}),
    },
    orderBy: { receivedAt: "desc" },
    take: 5,
    select: {
      id: true,
      channel: true,
      fromAddress: true,
      subject: true,
      bodyText: true,
    },
  });

  return {
    conversationSummary,
    customerFacts: customerFacts.map((f) => ({ key: f.key, value: f.value })),
    recentMessages: recentMessages.map((m) => ({
      id: m.id,
      channel: m.channel,
      from: m.fromAddress,
      subject: m.subject,
      snippet: (m.bodyText ?? "").slice(0, 200),
    })),
  };
}

export async function upsertConversationSummary(params: {
  organizationId: string;
  conversationId: string;
  summaryText: string;
  lastMessageAt?: Date | null;
}) {
  return prisma.conversationMemory.upsert({
    where: { conversationId: params.conversationId },
    create: {
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      summaryText: params.summaryText,
      lastMessageAt: params.lastMessageAt ?? new Date(),
    },
    update: {
      summaryText: params.summaryText,
      lastMessageAt: params.lastMessageAt ?? new Date(),
    },
  });
}
