import { prisma } from "@/server/db";
import { interpolateObject } from "@/server/automation/template";
import { populateTableFromInbox } from "@/server/extraction-tables/populate-from-inbox";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleExtractToTable(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );

  const tableId = String(config.tableId ?? "").trim();
  const tableName = String(config.tableName ?? "").trim();
  const messageId =
    String(config.messageId ?? params.context.trigger.messageId ?? "").trim();

  const table = tableId
    ? await prisma.extractionTable.findFirst({
        where: { id: tableId, organizationId: params.organizationId },
      })
    : tableName
      ? await prisma.extractionTable.findFirst({
          where: {
            organizationId: params.organizationId,
            name: { equals: tableName, mode: "insensitive" },
          },
        })
      : await prisma.extractionTable.findFirst({
          where: { organizationId: params.organizationId },
          orderBy: { updatedAt: "desc" },
        });

  if (!table) {
    return { output: { ok: false, error: "No extraction table found" } };
  }

  if (!messageId) {
    return { output: { ok: false, error: "No messageId to extract" } };
  }

  const result = await populateTableFromInbox(table.id, params.organizationId, {
    messageIds: [messageId],
    forceRefresh: true,
  });

  return {
    output: {
      ok: result.succeeded > 0,
      tableId: table.id,
      tableName: table.name,
      ...result,
    },
    variables: { extractedTableId: table.id },
  };
}
