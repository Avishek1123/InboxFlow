import {
  getTriggerSettings,
  messageMatchesTriggerFilters,
} from "@/lib/gmail/trigger-filters";
import { extractCustomTableRow } from "@/server/ai/custom-table-extract";
import { inboxRepository } from "@/server/repositories/inbox.repository";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import { prisma } from "@/server/db";

function parseLabels(labels: unknown): string[] {
  if (Array.isArray(labels)) {
    return labels.filter((l): l is string => typeof l === "string");
  }
  return [];
}

function whatsAppSubject(
  fromAddress: string,
  contactName: string | null | undefined
): string {
  const name = contactName?.trim();
  return name ? `WhatsApp: ${name}` : `WhatsApp: ${fromAddress}`;
}

async function listSyncedMessagesMissingTableRows(
  tableId: string,
  organizationId: string,
  limit: number
): Promise<InboxMessageForExtract[]> {
  const gmailAccount = await gmailRepository.findGmailAccount(organizationId);
  const activeFilters = getTriggerSettings(gmailAccount?.metadata);

  const candidateLimit = Math.max(limit * 3, limit);
  const rows = await prisma.message.findMany({
    where: {
      organizationId,
      channel: { in: ["GMAIL", "WHATSAPP"] },
      extractionTableRows: {
        none: { tableId },
      },
    },
    orderBy: { receivedAt: "desc" },
    take: candidateLimit,
    include: {
      conversation: {
        select: { snippet: true, participantName: true },
      },
    },
  });

  const out: InboxMessageForExtract[] = [];
  for (const row of rows) {
    if (row.channel === "GMAIL") {
      if (
        !messageMatchesTriggerFilters(parseLabels(row.labels), activeFilters)
      ) {
        continue;
      }
    }

    out.push({
      id: row.id,
      fromAddress: row.fromAddress,
      subject:
        row.subject ??
        (row.channel === "WHATSAPP"
          ? whatsAppSubject(row.fromAddress, row.conversation.participantName)
          : null),
      bodyText: row.bodyText,
      snippet:
        row.conversation.snippet ?? row.bodyText?.slice(0, 200) ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

type InboxMessageForExtract = {
  id: string;
  fromAddress: string;
  subject: string | null;
  bodyText: string | null;
  snippet: string | null;
};

export async function populateTableFromInbox(
  tableId: string,
  organizationId: string,
  options?: {
    limit?: number;
    forceRefresh?: boolean;
    messageIds?: string[];
    /** Extract synced Gmail rows not yet in this table (scans DB, not just recent inbox UI). */
    fillMissing?: boolean;
  }
) {
  const table = await extractionTableRepository.getById(tableId, organizationId);
  if (!table) throw new Error("Table not found");
  if (table.columns.length === 0) {
    throw new Error("Add at least one column before extracting");
  }

  const existingRows = await prisma.extractionTableRow.findMany({
    where: { tableId },
    select: { messageId: true },
  });
  const existingMessageIds = new Set(
    existingRows.map((r) => r.messageId).filter(Boolean)
  );

  const results: Array<{
    messageId: string;
    ok: boolean;
    error?: string;
  }> = [];

  const extractOne = async (
    msg: InboxMessageForExtract,
    forceRefresh: boolean
  ) => {
    if (!forceRefresh && existingMessageIds.has(msg.id)) {
      return;
    }

    try {
      const values = await extractCustomTableRow({
        organizationId,
        columns: table.columns,
        fromAddress: msg.fromAddress,
        subject: msg.subject,
        body: msg.bodyText ?? msg.snippet ?? "",
      });

      await extractionTableRepository.upsertRow({
        tableId,
        organizationId,
        messageId: msg.id,
        values,
        sourceSubject: msg.subject,
        sourceFrom: msg.fromAddress,
        sourceSnippet: msg.snippet,
      });

      existingMessageIds.add(msg.id);
      results.push({ messageId: msg.id, ok: true });
    } catch (err) {
      results.push({
        messageId: msg.id,
        ok: false,
        error: err instanceof Error ? err.message : "extract failed",
      });
    }
  };

  if (options?.messageIds?.length) {
    const pipelineRows = await prisma.message.findMany({
      where: {
        id: { in: options.messageIds },
        organizationId,
        channel: { in: ["GMAIL", "WHATSAPP"] },
      },
      include: {
        conversation: { select: { snippet: true, participantName: true } },
      },
    });

    for (const row of pipelineRows) {
      await extractOne(
        {
          id: row.id,
          fromAddress: row.fromAddress,
          subject:
            row.subject ??
            (row.channel === "WHATSAPP"
              ? whatsAppSubject(
                  row.fromAddress,
                  row.conversation.participantName
                )
              : null),
          bodyText: row.bodyText,
          snippet:
            row.conversation.snippet ?? row.bodyText?.slice(0, 200) ?? null,
        },
        options.forceRefresh ?? true
      );
    }

    return {
      processed: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  const limit = options?.limit ?? 20;

  const messages = options?.fillMissing
    ? await listSyncedMessagesMissingTableRows(tableId, organizationId, limit)
    : (
        await inboxRepository.listMessages(organizationId, { limit })
      ).messages;

  for (const msg of messages) {
    await extractOne(msg, options?.forceRefresh ?? false);
  }

  return {
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
