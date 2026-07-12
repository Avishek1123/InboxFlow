import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Public ping for Apps Script / tunnel health checks (no auth). */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "inboxflow-sheet-sync" },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
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
