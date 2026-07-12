/** Gmail post-sync + sheet automation settings. */
export function getSyncPipelineConfig() {
  const sheetSyncVia =
    process.env.SHEET_SYNC_VIA === "script" ? "script" : "server";

  return {
    enabled: process.env.GMAIL_AUTO_PIPELINE !== "false",
    whatsappEnabled: process.env.WHATSAPP_AUTO_PIPELINE !== "false",
    extractLimit: Number(process.env.GMAIL_EXTRACT_LIMIT ?? 100),
    /** Apps Script time-driven interval (minutes). */
    sheetTriggerMinutes: Number(process.env.INBOXFLOW_SHEET_TRIGGER_MINUTES ?? 1),
    /**
     * server (default) = push sheets after Gmail/WhatsApp pipeline + keep-alive.
     * script = rely mainly on Apps Script timer (legacy).
     */
    sheetSyncVia: sheetSyncVia as "script" | "server",
  };
}
