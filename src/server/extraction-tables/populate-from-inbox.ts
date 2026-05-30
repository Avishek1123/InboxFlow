import { extractCustomTableRow } from "@/server/ai/custom-table-extract";
import { inboxRepository } from "@/server/repositories/inbox.repository";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";
import { prisma } from "@/server/db";

export async function populateTableFromInbox(
  tableId: string,
  organizationId: string,
  options?: { limit?: number; forceRefresh?: boolean }
) {
  const table = await extractionTableRepository.getById(tableId, organizationId);
  if (!table) throw new Error("Table not found");
  if (table.columns.length === 0) {
    throw new Error("Add at least one column before extracting");
  }

  const limit = options?.limit ?? 20;
  const inbox = await inboxRepository.listMessages(organizationId, {
    channel: "GMAIL",
    limit,
  });

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

  for (const msg of inbox.messages) {
    if (!options?.forceRefresh && existingMessageIds.has(msg.id)) {
      continue;
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

      results.push({ messageId: msg.id, ok: true });
    } catch (err) {
      results.push({
        messageId: msg.id,
        ok: false,
        error: err instanceof Error ? err.message : "extract failed",
      });
    }
  }

  return {
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
