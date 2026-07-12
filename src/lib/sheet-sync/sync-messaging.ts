import { isLocalAppUrl } from "@/lib/app-url";

/** User-facing note after sheet creation (Apps Script timer; permissions on website). */
export function buildSheetExportSyncNote(params: {
  apiBaseUrl: string;
  scriptTriggerReady: boolean;
  setupNote?: string;
  triggerMinutes?: number;
}): string {
  if (params.setupNote && !params.scriptTriggerReady) return params.setupNote;

  const minutes = params.triggerMinutes ?? 1;

  if (isLocalAppUrl(params.apiBaseUrl)) {
    return (
      "Sheet created with your data. Set NEXT_PUBLIC_APP_URL or NGROK_AUTHTOKEN in .env and restart, then create again so the timer can reach your API."
    );
  }

  if (params.scriptTriggerReady) {
    return `Your sheet is ready with a ${minutes}-minute Google timer — it will pull new rows from InboxFlow automatically.`;
  }

  return "Your sheet was created. Grant Google permissions in the popup on this page to finish installing the timer.";
}
