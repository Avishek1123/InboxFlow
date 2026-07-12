import { prisma } from "@/server/db";
import type { SheetExportRecord } from "@/types/sheet-export";
import { persistSheetExportAppsScriptId } from "@/server/repositories/sheet-export-apps-script-id";

function toRecord(
  row: {
    id: string;
    extractionTableId: string;
    label: string | null;
    sheetTitle: string;
    spreadsheetId: string | null;
    spreadsheetUrl: string | null;
    appsScriptId: string | null;
    syncIntervalMinutes?: number;
    apiKeyPrefix: string;
    createdAt: Date;
    updatedAt: Date;
    lastFetchedAt: Date | null;
    extractionTable: { name: string };
  }
): SheetExportRecord {
  return {
    id: row.id,
    extractionTableId: row.extractionTableId,
    extractionTableName: row.extractionTable.name,
    label: row.label,
    sheetTitle: row.sheetTitle,
    spreadsheetId: row.spreadsheetId,
    spreadsheetUrl: row.spreadsheetUrl,
    appsScriptId: row.appsScriptId,
    syncIntervalMinutes: row.syncIntervalMinutes ?? 1,
    apiKeyPrefix: row.apiKeyPrefix,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null,
  };
}

const includeTable = { extractionTable: { select: { name: true } } } as const;

export const sheetExportRepository = {
  async list(organizationId: string): Promise<SheetExportRecord[]> {
    const items = await prisma.sheetExport.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      include: includeTable,
    });
    return items.map(toRecord);
  },

  async getById(id: string, organizationId: string) {
    const row = await prisma.sheetExport.findFirst({
      where: { id, organizationId },
      include: includeTable,
    });
    return row ? toRecord(row) : null;
  },

  async findByTableId(organizationId: string, extractionTableId: string) {
    const row = await prisma.sheetExport.findUnique({
      where: {
        organizationId_extractionTableId: {
          organizationId,
          extractionTableId,
        },
      },
      include: includeTable,
    });
    return row ? toRecord(row) : null;
  },

  async updateAfterProvision(
    id: string,
    organizationId: string,
    data: {
      spreadsheetId: string;
      spreadsheetUrl: string;
      sheetTitle: string;
      appsScriptId?: string;
      apiKeyHash: string;
      apiKeyPrefix: string;
      label?: string;
    }
  ): Promise<SheetExportRecord> {
    const row = await prisma.sheetExport.update({
      where: { id },
      data: {
        spreadsheetId: data.spreadsheetId,
        spreadsheetUrl: data.spreadsheetUrl,
        sheetTitle: data.sheetTitle,
        apiKeyHash: data.apiKeyHash,
        apiKeyPrefix: data.apiKeyPrefix,
        ...(data.label !== undefined ? { label: data.label } : {}),
      },
      include: includeTable,
    });
    if (row.organizationId !== organizationId) {
      throw new Error("Sheet export not found");
    }
    if (data.appsScriptId) {
      await persistSheetExportAppsScriptId(row.id, data.appsScriptId);
    }
    return toRecord({ ...row, appsScriptId: data.appsScriptId ?? row.appsScriptId });
  },

  async findByApiKeyHash(apiKeyHash: string) {
    return prisma.sheetExport.findFirst({
      where: { apiKeyHash },
      include: { extractionTable: true },
    });
  },

  async create(params: {
    organizationId: string;
    extractionTableId: string;
    label?: string;
    sheetTitle: string;
    spreadsheetId: string;
    spreadsheetUrl: string;
    appsScriptId?: string;
    syncIntervalMinutes?: number;
    apiKeyHash: string;
    apiKeyPrefix: string;
  }): Promise<SheetExportRecord> {
    const { appsScriptId, syncIntervalMinutes, ...createParams } = params;
    const row = await prisma.sheetExport.create({
      data: {
        organizationId: createParams.organizationId,
        extractionTableId: createParams.extractionTableId,
        label: createParams.label,
        sheetTitle: createParams.sheetTitle,
        spreadsheetId: createParams.spreadsheetId,
        spreadsheetUrl: createParams.spreadsheetUrl,
        syncIntervalMinutes: Math.max(
          1,
          Math.min(60, syncIntervalMinutes ?? 1)
        ),
        apiKeyHash: createParams.apiKeyHash,
        apiKeyPrefix: createParams.apiKeyPrefix,
      },
      include: includeTable,
    });
    if (appsScriptId) {
      await persistSheetExportAppsScriptId(row.id, appsScriptId);
    }
    return toRecord({ ...row, appsScriptId: appsScriptId ?? null });
  },

  async updateSyncInterval(
    id: string,
    organizationId: string,
    syncIntervalMinutes: number
  ) {
    await prisma.sheetExport.updateMany({
      where: { id, organizationId },
      data: {
        syncIntervalMinutes: Math.max(1, Math.min(60, syncIntervalMinutes)),
      },
    });
  },

  async update(
    id: string,
    organizationId: string,
    data: {
      spreadsheetUrl?: string | null;
      spreadsheetId?: string | null;
      label?: string;
      sheetTitle?: string;
    }
  ) {
    return prisma.sheetExport.updateMany({
      where: { id, organizationId },
      data,
    });
  },

  async updateAppsScriptId(
    id: string,
    organizationId: string,
    appsScriptId: string
  ) {
    const row = await prisma.sheetExport.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!row) return { count: 0 };
    await persistSheetExportAppsScriptId(id, appsScriptId);
    return { count: 1 };
  },

  async updateApiKey(
    id: string,
    organizationId: string,
    apiKeyHash: string,
    apiKeyPrefix: string
  ) {
    return prisma.sheetExport.updateMany({
      where: { id, organizationId },
      data: { apiKeyHash, apiKeyPrefix },
    });
  },

  async touchFetched(id: string) {
    return prisma.sheetExport.update({
      where: { id },
      data: { lastFetchedAt: new Date() },
    });
  },

  async delete(id: string, organizationId: string) {
    return prisma.sheetExport.deleteMany({
      where: { id, organizationId },
    });
  },
};
