import { prisma } from "@/server/db";
import { interpolateObject } from "@/server/automation/template";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleQueryTable(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );
  const tableId = String(config.tableId ?? "").trim();
  const tableName = String(config.tableName ?? "").trim();
  const limit = Math.min(Number(config.limit ?? 20) || 20, 100);

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
    return { output: { error: "No extraction table found", rows: [] } };
  }

  const rows = await prisma.extractionTableRow.findMany({
    where: { tableId: table.id, organizationId: params.organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const items = rows.map((r) => ({
    id: r.id,
    messageId: r.messageId,
    values: r.values,
    sourceFrom: r.sourceFrom,
    sourceSubject: r.sourceSubject,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    output: {
      tableId: table.id,
      tableName: table.name,
      columns: table.columns,
      count: items.length,
      rows: items,
    },
    variables: { tableRows: items, tableId: table.id },
  };
}
