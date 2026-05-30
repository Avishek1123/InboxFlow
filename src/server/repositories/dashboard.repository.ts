import { prisma } from "@/server/db";
import { automationRepository } from "@/server/repositories/automation.repository";

export type DashboardOverview = {
  stats: {
    conversations: number;
    messages7d: number;
    activeAutomations: number;
    totalAutomations: number;
    aiExtractions7d: number;
    executions24h: number;
    automationSuccessRate: number;
    pendingOutbound: number;
  };
  messagesByDay: Array<{ label: string; count: number }>;
  integrations: {
    gmail: { connected: boolean; status: string | null; email: string | null };
    whatsapp: {
      connected: boolean;
      status: string | null;
      displayName: string | null;
    };
  };
  recentConversations: Array<{
    id: string;
    channel: string;
    subject: string | null;
    participantName: string | null;
    snippet: string | null;
    lastMessageAt: Date | null;
  }>;
  recentExecutions: Array<{
    id: string;
    automationName: string;
    status: string;
    startedAt: Date;
  }>;
};

function dayBuckets(): Array<{ start: Date; end: Date; label: string }> {
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    buckets.push({
      start,
      end,
      label: start.toLocaleDateString("en-US", { weekday: "short" }),
    });
  }
  return buckets;
}

export async function getDashboardOverview(
  organizationId: string
): Promise<DashboardOverview> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const buckets = dayBuckets();

  const [
    conversations,
    messages7d,
    aiExtractions7d,
    automationStats,
    pendingOutbound,
    accounts,
    recentConversations,
    recentExecutions,
    ...dayCounts
  ] = await Promise.all([
    prisma.conversation.count({
      where: { organizationId, isArchived: false },
    }),
    prisma.message.count({
      where: { organizationId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.aiExtraction.count({
      where: { organizationId, createdAt: { gte: sevenDaysAgo } },
    }),
    automationRepository.getMonitoringStats(organizationId),
    prisma.whatsAppOutboundJob.count({
      where: { organizationId, status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.connectedAccount.findMany({
      where: { organizationId },
      select: {
        provider: true,
        status: true,
        accountEmail: true,
      },
    }),
    prisma.conversation.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { lastMessageAt: "desc" },
      take: 5,
      select: {
        id: true,
        channel: true,
        subject: true,
        participantName: true,
        snippet: true,
        lastMessageAt: true,
      },
    }),
    prisma.automationExecution.findMany({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        automation: { select: { name: true } },
      },
    }),
    ...buckets.map((b) =>
      prisma.message.count({
        where: {
          organizationId,
          createdAt: { gte: b.start, lt: b.end },
        },
      })
    ),
  ]);

  const messagesByDay = buckets.map((b, i) => ({
    label: b.label,
    count: dayCounts[i] ?? 0,
  }));

  const gmail = accounts.find((a) => a.provider === "GMAIL");
  const whatsapp = accounts.find((a) => a.provider === "WHATSAPP");

  return {
    stats: {
      conversations,
      messages7d,
      activeAutomations: automationStats.activeAutomations,
      totalAutomations: automationStats.totalAutomations,
      aiExtractions7d,
      executions24h: automationStats.executions24h,
      automationSuccessRate: automationStats.successRate24h,
      pendingOutbound,
    },
    messagesByDay,
    integrations: {
      gmail: {
        connected: gmail?.status === "ACTIVE",
        status: gmail?.status ?? null,
        email: gmail?.accountEmail ?? null,
      },
      whatsapp: {
        connected: whatsapp?.status === "ACTIVE",
        status: whatsapp?.status ?? null,
        displayName: whatsapp?.accountEmail ?? null,
      },
    },
    recentConversations,
    recentExecutions: recentExecutions.map((e) => ({
      id: e.id,
      automationName: e.automation.name,
      status: e.status,
      startedAt: e.startedAt,
    })),
  };
}
