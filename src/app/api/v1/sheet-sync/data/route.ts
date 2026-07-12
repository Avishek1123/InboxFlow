import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { DEFAULT_SHEET_SYNC_GMAIL_FILTER } from "@/lib/sheet-sync/gmail-filter";
import { prepareSheetExportData } from "@/server/google-sheets/prepare-sheet-export-data";
import { buildSheetSyncPayload } from "@/server/sheet-sync/build-export-payload";
import { authenticateSheetSyncRequest } from "@/server/sheet-sync/authenticate-request";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Public endpoint for Google Apps Script (Bearer API key). */
export async function GET(request: Request) {
  try {
    const export_ = await authenticateSheetSyncRequest(request);
    if (!export_) {
      return apiError(
        "UNAUTHORIZED",
        "Invalid or missing API key. In InboxFlow open Google Sheets → Update script, then try Sync now in the sheet.",
        401
      );
    }

    const url = new URL(request.url);
    const tableId = url.searchParams.get("tableId") ?? export_.extractionTableId;

    if (tableId !== export_.extractionTableId) {
      return apiError("FORBIDDEN", "API key is not valid for this table", 403);
    }

    await prepareSheetExportData({
      organizationId: export_.organizationId,
      extractionTableId: export_.extractionTableId,
      /** Sheet Sync now / timer must pick up newly starred mail immediately. */
      forceGmailSync: true,
    });

    const payload = await buildSheetSyncPayload(
      export_.extractionTableId,
      export_.organizationId,
      { gmailFilter: DEFAULT_SHEET_SYNC_GMAIL_FILTER }
    );
    if (!payload) {
      return apiError("NOT_FOUND", "Table not found", 404);
    }

    await sheetExportRepository.touchFetched(export_.id);

    return NextResponse.json(
      { data: payload },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    if (
      message.includes("Can't reach database server") ||
      message.includes("Connection refused") ||
      message.includes("ECONNREFUSED")
    ) {
      return apiError(
        "DATABASE_UNAVAILABLE",
        "InboxFlow database is offline. Start Postgres (Docker Desktop → docker compose up -d postgres) and restart npm run dev.",
        503
      );
    }
    console.error("[sheet-sync/data]", err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, X-Inboxflow-Api-Key, Bypass-Tunnel-Reminder, ngrok-skip-browser-warning, User-Agent",
    },
  });
}
