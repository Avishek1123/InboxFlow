import { NextResponse } from "next/server";
import { syncAllActiveGmailAccounts } from "@/server/gmail/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncAllActiveGmailAccounts();

  return NextResponse.json({
    ok: true,
    accounts: results.length,
    results,
    hint: "Schedule this endpoint every 5–15 min (e.g. cron) for starred-mail → sheet automation.",
    timestamp: new Date().toISOString(),
  });
}
