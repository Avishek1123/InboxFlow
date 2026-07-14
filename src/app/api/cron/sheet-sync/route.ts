import { NextResponse } from "next/server";
import { syncAllActiveGmailAccounts } from "@/server/gmail/sync";
import { syncSheetExportFull } from "@/server/google-sheets/sync-sheet-export-full";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Every-minute sheet autosync (cron / external scheduler).
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Refresh Gmail first so starred messages are in DB
  let gmailResults: Awaited<ReturnType<typeof syncAllActiveGmailAccounts>> = [];
  try {
    gmailResults = await syncAllActiveGmailAccounts();
  } catch (err) {
    console.error("[cron/sheet-sync] gmail", err);
  }

  const exports = await prisma.sheetExport.findMany({
    where: { spreadsheetId: { not: null } },
    select: {
      id: true,
      organizationId: true,
      syncIntervalMinutes: true,
      lastFetchedAt: true,
      sheetTitle: true,
    },
  });

  const now = Date.now();
  const sheetResults: Array<{
    exportId: string;
    ok: boolean;
    rowCount?: number;
    skipped?: boolean;
    error?: string;
  }> = [];

  for (const exp of exports) {
    const intervalMs = Math.max(1, exp.syncIntervalMinutes ?? 1) * 60_000;
    const last = exp.lastFetchedAt?.getTime() ?? 0;
    // Allow slight drift; always run if never fetched
    if (last > 0 && now - last < intervalMs - 10_000) {
      sheetResults.push({ exportId: exp.id, ok: true, skipped: true });
      continue;
    }

    try {
      const result = await syncSheetExportFull({
        organizationId: exp.organizationId,
        exportId: exp.id,
      });
      sheetResults.push({
        exportId: exp.id,
        ok: true,
        rowCount: result.rowCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      console.warn(`[cron/sheet-sync] ${exp.id}:`, message);
      sheetResults.push({ exportId: exp.id, ok: false, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    gmailAccounts: gmailResults.length,
    sheets: sheetResults,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  return GET(request);
}
