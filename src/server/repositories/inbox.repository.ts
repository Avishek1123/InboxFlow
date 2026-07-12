import {
  getTriggerSettings,
  messageMatchesTriggerFilters,
  presetById,
} from "@/lib/gmail/trigger-filters";
import { prisma } from "@/server/db";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import type { GmailTriggerSettings } from "@/types/gmail";
import type { InboxListResponse, InboxMessageItem } from "@/types/inbox";

function parseLabels(labels: unknown): string[] {
  if (Array.isArray(labels)) {
    return labels.filter((l): l is string => typeof l === "string");
  }
  return [];
}

export function formatFilterSummary(settings: GmailTriggerSettings): string {
  if (settings.filterIds.length === 0) return "All messages";
  const names = settings.filterIds
    .map((id) => presetById(id)?.label ?? id)
    .join(", ");
  return settings.mode === "all"
    ? `Showing: ${names} (match all)`
    : `Showing: ${names} (match any)`;
}

export const inboxRepository = {
  async listMessages(
    organizationId: string,
    options?: { limit?: number; channel?: "GMAIL" | "WHATSAPP" | "SMS" }
  ): Promise<InboxListResponse> {
    const limit = options?.limit ?? 100;
    const channel = options?.channel;

    const gmailAccount = await gmailRepository.findGmailAccount(organizationId);
    const activeFilters = getTriggerSettings(gmailAccount?.metadata);

    const rows = await prisma.message.findMany({
      where: {
        organizationId,
        ...(channel ? { channel } : {}),
      },
      orderBy: { receivedAt: "desc" },
      take: 500,
      include: {
        conversation: {
          select: { snippet: true },
        },
      },
    });

    const filtered: Omit<
      InboxMessageItem,
      "isExtracted" | "extractedTableNames"
    >[] = [];

    for (const row of rows) {
      const labels = parseLabels(row.labels);

      if (row.channel === "GMAIL") {
        if (!messageMatchesTriggerFilters(labels, activeFilters)) {
          continue;
        }
      }

      filtered.push({
        id: row.id,
        conversationId: row.conversationId,
        channel: row.channel,
        fromAddress: row.fromAddress,
        subject: row.subject,
        bodyText: row.bodyText,
        snippet: row.conversation.snippet ?? row.bodyText?.slice(0, 200) ?? null,
        receivedAt: row.receivedAt.toISOString(),
        labels,
        isRead: row.isRead,
        hasAttachments: row.hasAttachments,
      });

      if (filtered.length >= limit) break;
    }

    const extractedByMessage =
      await extractionTableRepository.getExtractedTablesByMessageIds(
        organizationId,
        filtered.map((m) => m.id)
      );

    const messages = filtered.map((msg) => {
      const extractedTableNames = extractedByMessage.get(msg.id) ?? [];
      return {
        ...msg,
        isExtracted: extractedTableNames.length > 0,
        extractedTableNames,
      };
    });

    return {
      messages,
      total: filtered.length,
      activeFilters,
      filterSummary: formatFilterSummary(activeFilters),
    };
  },
};
