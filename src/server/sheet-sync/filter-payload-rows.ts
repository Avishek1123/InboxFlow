import {
  DEFAULT_SHEET_SYNC_GMAIL_FILTER,
  SHEET_SYNC_STARRED_LABEL,
  type SheetSyncGmailFilter,
} from "@/lib/sheet-sync/gmail-filter";
import type { ExtractionTableRowRecord } from "@/types/extraction-table";
import { prisma } from "@/server/db";

function parseLabels(labels: unknown): string[] {
  if (Array.isArray(labels)) {
    return labels.filter((l): l is string => typeof l === "string");
  }
  return [];
}

/**
 * Filter extraction rows for Google Sheet export.
 * "starred" = Gmail messages with STARRED label (+ keep WhatsApp rows).
 */
export async function filterRowsForSheetSync(
  rows: ExtractionTableRowRecord[],
  organizationId: string,
  filter: SheetSyncGmailFilter = DEFAULT_SHEET_SYNC_GMAIL_FILTER
): Promise<ExtractionTableRowRecord[]> {
  if (filter === "all") return rows;

  const messageIds = rows
    .map((r) => r.messageId)
    .filter((id): id is string => Boolean(id));

  if (messageIds.length === 0) return [];

  const messages = await prisma.message.findMany({
    where: {
      organizationId,
      id: { in: messageIds },
    },
    select: {
      id: true,
      channel: true,
      labels: true,
    },
  });

  const byId = new Map(messages.map((m) => [m.id, m]));

  return rows.filter((row) => {
    if (!row.messageId) return false;
    const msg = byId.get(row.messageId);
    if (!msg) return false;
    // Non-Gmail channels (WhatsApp, etc.) stay in the sheet.
    if (msg.channel !== "GMAIL") return true;
    return parseLabels(msg.labels).includes(SHEET_SYNC_STARRED_LABEL);
  });
}
