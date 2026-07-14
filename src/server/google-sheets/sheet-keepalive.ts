import { syncSheetExportFull } from "@/server/google-sheets/sync-sheet-export-full";
import { prisma } from "@/server/db";

let started = false;
let tickRunning = false;

/**
 * Server-side sheet keep-alive: periodically sync Gmail → extract → push Sheets API.
 * Does not depend on Apps Script timers or public tunnels for the ready-product path.
 */
export function startSheetKeepAliveWorker() {
  if (started) return;
  if (process.env.SHEET_KEEPALIVE === "false") return;
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;

  started = true;
  const tickMs = Number(process.env.SHEET_KEEPALIVE_TICK_MS ?? 60_000);

  console.info(
    `[sheet-keepalive] Started (tick every ${Math.round(tickMs / 1000)}s). Website-driven starred-mail → sheet sync.`
  );

  const run = () => {
    void tickDueSheetExports().catch((err) =>
      console.error("[sheet-keepalive]", err)
    );
  };

  // Immediate + recurring. Also used as a local fallback when Vercel cron is unavailable.
  setTimeout(run, 3_000);
  setInterval(run, tickMs);
}

/** Safe to call from API routes — starts the worker if instrumentation missed it. */
export function ensureSheetKeepAliveWorker() {
  startSheetKeepAliveWorker();
}

async function tickDueSheetExports() {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const exports = await prisma.sheetExport.findMany({
      where: { spreadsheetId: { not: null } },
      select: {
        id: true,
        organizationId: true,
        syncIntervalMinutes: true,
        lastFetchedAt: true,
      },
    });

    const now = Date.now();
    for (const exp of exports) {
      const intervalMs = Math.max(1, exp.syncIntervalMinutes ?? 1) * 60_000;
      const last = exp.lastFetchedAt?.getTime() ?? 0;
      if (now - last < intervalMs - 5_000) continue;

      try {
        await syncSheetExportFull({
          organizationId: exp.organizationId,
          exportId: exp.id,
        });
      } catch (err) {
        console.warn(
          `[sheet-keepalive] export ${exp.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  } finally {
    tickRunning = false;
  }
}
