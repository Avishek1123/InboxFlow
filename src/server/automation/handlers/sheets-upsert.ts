import { prisma } from "@/server/db";
import { interpolateObject } from "@/server/automation/template";
import { populateTableFromInbox } from "@/server/extraction-tables/populate-from-inbox";
import { pushSheetExportDataFromServer } from "@/server/google-sheets/push-sheet-export-data";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleSheetsUpsert(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );

  let exportRow = null as Awaited<
    ReturnType<typeof prisma.sheetExport.findFirst>
  >;

  const exportId = String(config.exportId ?? "").trim();
  const tableId = String(config.tableId ?? "").trim();

  if (exportId) {
    exportRow = await prisma.sheetExport.findFirst({
      where: { id: exportId, organizationId: params.organizationId },
    });
  } else if (tableId) {
    exportRow = await prisma.sheetExport.findFirst({
      where: { extractionTableId: tableId, organizationId: params.organizationId },
    });
  } else {
    exportRow = await prisma.sheetExport.findFirst({
      where: { organizationId: params.organizationId },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!exportRow) {
    return {
      output: {
        ok: false,
        message: "No linked Google Sheet export found for this organization",
      },
    };
  }

  const messageId =
    String(config.messageId ?? params.context.trigger.messageId ?? "") ||
    undefined;

  if (messageId) {
    await populateTableFromInbox(exportRow.extractionTableId, params.organizationId, {
      messageIds: [messageId],
      forceRefresh: true,
    });
  }

  const pushed = await pushSheetExportDataFromServer({
    organizationId: params.organizationId,
    exportId: exportRow.id,
  });

  return {
    output: {
      ok: true,
      exportId: exportRow.id,
      spreadsheetUrl: exportRow.spreadsheetUrl,
      rowCount: pushed.rowCount,
    },
    variables: {
      sheetExportId: exportRow.id,
      sheetRowCount: pushed.rowCount,
    },
  };
}
