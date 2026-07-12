import { prisma } from "@/server/db";

/** Persist appsScriptId without relying on a hot-reloaded Prisma client shape. */
export async function persistSheetExportAppsScriptId(
  exportId: string,
  appsScriptId: string
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE sheet_exports
    SET "appsScriptId" = ${appsScriptId}
    WHERE id = ${exportId}
  `;
}

export async function readSheetExportAppsScriptId(
  exportId: string
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ appsScriptId: string | null }[]>`
    SELECT "appsScriptId" FROM sheet_exports WHERE id = ${exportId}
  `;
  return rows[0]?.appsScriptId ?? null;
}
