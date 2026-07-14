import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

/**
 * Apps Script writes trigger status to a hidden `_InboxFlow` tab so the server
 * can confirm the timer even when scripts.run / GCP linking fails.
 */
export async function readInboxFlowTriggerMeta(
  auth: OAuth2Client,
  spreadsheetId: string
): Promise<{ triggerCount: number; updatedAt: string | null }> {
  const sheets = google.sheets({ version: "v4", auth });
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "_InboxFlow!A1:B2",
    });
    const rows = res.data.values ?? [];
    let triggerCount = 0;
    let updatedAt: string | null = null;
    for (const row of rows) {
      const key = String(row[0] ?? "").trim();
      const value = String(row[1] ?? "").trim();
      if (key === "triggerCount") {
        const n = Number(value);
        if (Number.isFinite(n)) triggerCount = n;
      }
      if (key === "updatedAt") updatedAt = value || null;
    }
    return { triggerCount, updatedAt };
  } catch {
    return { triggerCount: 0, updatedAt: null };
  }
}
