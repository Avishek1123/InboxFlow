import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type {
  ExtractionColumn,
  ExtractionTableRecord,
  ExtractionTableRowRecord,
} from "@/types/extraction-table";

function parseColumns(raw: unknown): ExtractionColumn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === "object" && "key" in c && "label" in c)
    .map((c) => c as ExtractionColumn);
}

export const extractionTableRepository = {
  async list(organizationId: string): Promise<ExtractionTableRecord[]> {
    const tables = await prisma.extractionTable.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { rows: true } } },
    });
    return tables.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      columns: parseColumns(t.columns),
      rowCount: t._count.rows,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  },

  async getById(id: string, organizationId: string) {
    const table = await prisma.extractionTable.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { rows: true } } },
    });
    if (!table) return null;
    return {
      id: table.id,
      name: table.name,
      description: table.description,
      columns: parseColumns(table.columns),
      rowCount: table._count.rows,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
    } satisfies ExtractionTableRecord;
  },

  async create(params: {
    organizationId: string;
    name: string;
    description?: string;
    columns: ExtractionColumn[];
  }) {
    return prisma.extractionTable.create({
      data: {
        organizationId: params.organizationId,
        name: params.name,
        description: params.description,
        columns: params.columns as unknown as Prisma.InputJsonValue,
      },
    });
  },

  async update(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      description?: string;
      columns?: ExtractionColumn[];
    }
  ) {
    return prisma.extractionTable.updateMany({
      where: { id, organizationId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.columns !== undefined
          ? { columns: data.columns as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  },

  async delete(id: string, organizationId: string) {
    return prisma.extractionTable.deleteMany({
      where: { id, organizationId },
    });
  },

  async listRows(
    tableId: string,
    organizationId: string
  ): Promise<ExtractionTableRowRecord[]> {
    const rows = await prisma.extractionTableRow.findMany({
      where: { tableId, organizationId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      tableId: r.tableId,
      messageId: r.messageId,
      values: r.values as Record<string, string | null>,
      sourceSubject: r.sourceSubject,
      sourceFrom: r.sourceFrom,
      sourceSnippet: r.sourceSnippet,
      createdAt: r.createdAt.toISOString(),
    }));
  },

  /** Map messageId → table names that have extracted this message */
  async getExtractedTablesByMessageIds(
    organizationId: string,
    messageIds: string[]
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (messageIds.length === 0) return map;

    const rows = await prisma.extractionTableRow.findMany({
      where: {
        organizationId,
        messageId: { in: messageIds },
      },
      select: {
        messageId: true,
        table: { select: { name: true } },
      },
    });

    for (const row of rows) {
      if (!row.messageId) continue;
      const existing = map.get(row.messageId) ?? [];
      if (!existing.includes(row.table.name)) {
        existing.push(row.table.name);
      }
      map.set(row.messageId, existing);
    }
    return map;
  },

  async deleteRow(rowId: string, tableId: string, organizationId: string) {
    return prisma.extractionTableRow.deleteMany({
      where: { id: rowId, tableId, organizationId },
    });
  },

  async clearRows(tableId: string, organizationId: string) {
    return prisma.extractionTableRow.deleteMany({
      where: { tableId, organizationId },
    });
  },

  async upsertRow(params: {
    tableId: string;
    organizationId: string;
    messageId: string;
    values: Record<string, string | null>;
    sourceSubject: string | null;
    sourceFrom: string;
    sourceSnippet: string | null;
  }) {
    return prisma.extractionTableRow.upsert({
      where: {
        tableId_messageId: {
          tableId: params.tableId,
          messageId: params.messageId,
        },
      },
      create: {
        tableId: params.tableId,
        organizationId: params.organizationId,
        messageId: params.messageId,
        values: params.values as unknown as Prisma.InputJsonValue,
        sourceSubject: params.sourceSubject,
        sourceFrom: params.sourceFrom,
        sourceSnippet: params.sourceSnippet,
      },
      update: {
        values: params.values as unknown as Prisma.InputJsonValue,
        sourceSubject: params.sourceSubject,
        sourceFrom: params.sourceFrom,
        sourceSnippet: params.sourceSnippet,
      },
    });
  },
};
