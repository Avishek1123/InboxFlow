import {
  APPS_SCRIPT_USER_SETTINGS_URL,
  inboxflowApiEnableUrl,
  INBOXFLOW_GCP_PROJECT_NUMBER,
  isInboxflowGcpProject,
  wrongGoogleCloudProjectMessage,
} from "@/lib/gmail/inboxflow-gcp";

/** Google requires this user-level toggle before the Apps Script API can create projects. */
export function isAppsScriptUserSettingsError(err: unknown): boolean {
  const msg = extractGoogleErrorMessage(err);
  return (
    msg.includes("User has not enabled the Apps Script API") ||
    msg.includes("has not enabled the Apps Script API")
  );
}

export function appsScriptUserSettingsMessage(): string {
  return (
    `Turn on "Google Apps Script API" for your Google account at ${APPS_SCRIPT_USER_SETTINGS_URL} ` +
    `(this is separate from enabling Apps Script API in Google Cloud). Wait a few minutes, then create the sheet again. ` +
    `You can still use Sync now in InboxFlow without this setting.`
  );
}

/** User-facing message when Sheets/Script API is off or wrong GCP project. */
export function formatGoogleApiDisabledError(err: unknown): string | null {
  const msg = extractGoogleErrorMessage(err);
  if (!msg) return null;

  const projectMatch = msg.match(/project (\d+)/);
  const errorProjectNumber = projectMatch?.[1];
  const apiMatch = msg.match(/api\/([a-z0-9.]+)/i);
  const apiName = apiMatch?.[1] ?? "sheets.googleapis.com";

  if (
    errorProjectNumber &&
    !isInboxflowGcpProject(errorProjectNumber)
  ) {
    const clientPrefix = process.env.GOOGLE_CLIENT_ID?.split("-")[0];
    if (clientPrefix === INBOXFLOW_GCP_PROJECT_NUMBER) {
      return (
        `Google Sheets API is not enabled on project ${errorProjectNumber}, but your OAuth client is InboxFlow (${INBOXFLOW_GCP_PROJECT_NUMBER}). ` +
        `Your Gmail login may still be using an old token — remove InboxFlow at https://myaccount.google.com/permissions, ` +
        `then Integrations → Gmail → Disconnect → Connect, then retry. ` +
        `Also enable Sheets API on InboxFlow: ${inboxflowApiEnableUrl("sheets.googleapis.com")}`
      );
    }
    return wrongGoogleCloudProjectMessage(errorProjectNumber);
  }

  if (
    msg.includes("has not been used in project") ||
    msg.includes("it is disabled") ||
    msg.includes("SERVICE_DISABLED")
  ) {
    const enableUrl = inboxflowApiEnableUrl(apiName);

    const alsoEnable =
      apiName === "gmail.googleapis.com"
        ? "Also enable Sheets API and Apps Script API on the same project if you use Google Sheets."
        : "Also enable Gmail API and Apps Script API on the same project if you use Gmail sync.";

    return (
      `Enable "${apiName}" on the InboxFlow Google Cloud project ` +
      `(number ${INBOXFLOW_GCP_PROJECT_NUMBER}), wait 2–5 minutes, then retry: ${enableUrl} ` +
      alsoEnable
    );
  }

  return null;
}

function extractGoogleErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause && typeof cause === "object" && cause !== null && "message" in cause) {
      return String((cause as { message: string }).message);
    }
    return err.message;
  }
  return String(err);
}

/** HTTP status from googleapis GaxiosError (or similar). */
export function googleApiHttpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: number; response?: { status?: number } };
  if (typeof e.code === "number") return e.code;
  if (typeof e.response?.status === "number") return e.response.status;
  return undefined;
}

export function isGoogleNotFoundError(err: unknown): boolean {
  return googleApiHttpStatus(err) === 404;
}

/** Clearer copy when Gmail returns "Requested entity was not found." */
export function formatGmailSyncError(err: unknown): string | null {
  const msg = extractGoogleErrorMessage(err);
  if (!msg) return null;

  if (
    isGoogleNotFoundError(err) ||
    msg.includes("Requested entity was not found")
  ) {
    return (
      "Gmail sync hit a missing message or expired sync cursor (common after deleted mail or API changes). " +
      "Try Sync now again — missing items are skipped automatically."
    );
  }

  return formatGoogleApiDisabledError(err);
}
