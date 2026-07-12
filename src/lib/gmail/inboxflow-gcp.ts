/**
 * InboxFlow Google Cloud project — OAuth + Sheets must use this project only.
 * @see https://console.cloud.google.com/welcome?project=inboxflow-497809
 */
export const INBOXFLOW_GCP_PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT_ID ?? "inboxflow-497809";

export const INBOXFLOW_GCP_PROJECT_NUMBER =
  process.env.GOOGLE_CLOUD_PROJECT_NUMBER ?? "505199243507";

export function inboxflowCredentialsUrl(): string {
  return `https://console.cloud.google.com/apis/credentials?project=${INBOXFLOW_GCP_PROJECT_ID}`;
}

export function inboxflowApiEnableUrl(apiId: string): string {
  return `https://console.cloud.google.com/apis/library/${apiId}?project=${INBOXFLOW_GCP_PROJECT_ID}`;
}

/**
 * Per-user Apps Script API toggle (separate from enabling script.googleapis.com in GCP).
 * @see https://developers.google.com/apps-script/api/how-tos/enable
 */
export const APPS_SCRIPT_USER_SETTINGS_URL =
  "https://script.google.com/home/usersettings";

/** Shown when Google errors reference a different GCP project than InboxFlow. */
export function wrongGoogleCloudProjectMessage(errorProjectNumber: string): string {
  return (
    `Your Google OAuth client in .env belongs to GCP project ${errorProjectNumber}, ` +
    `not InboxFlow (project number ${INBOXFLOW_GCP_PROJECT_NUMBER}, id ${INBOXFLOW_GCP_PROJECT_ID}). ` +
    `Create a new OAuth 2.0 Client ID under the InboxFlow project, update GOOGLE_CLIENT_ID and ` +
    `GOOGLE_CLIENT_SECRET in .env, restart the app, then disconnect and reconnect Gmail. ` +
    `Credentials: ${inboxflowCredentialsUrl()}`
  );
}

/** One-time Apps Script editor step when scripts.run cannot use the default GCP project. */
export function inboxflowAppsScriptProjectSettingsUrl(scriptId: string): string {
  return `https://script.google.com/home/projects/${scriptId}/settings`;
}

export function inboxflowGcpLinkStepsMessage(scriptId: string): string {
  return [
    `1. Open Apps Script settings: ${inboxflowAppsScriptProjectSettingsUrl(scriptId)}`,
    `2. Under Google Cloud Platform (GCP) Project → Change project → enter ${INBOXFLOW_GCP_PROJECT_NUMBER} → Set project.`,
    `3. Confirm the page shows project inboxflow-497809 (or number ${INBOXFLOW_GCP_PROJECT_NUMBER}).`,
    `4. Wait 1 minute, then click Install sheet trigger on this page again.`,
    `Shortcut (no GCP step): open the sheet → InboxFlow → Enable auto-sync.`,
  ].join(" ");
}

export function inboxflowSheetTriggerFallbackMessage(
  scriptId: string
): string {
  return inboxflowGcpLinkStepsMessage(scriptId);
}

export function isInboxflowGcpProject(errorProjectNumber: string | undefined): boolean {
  if (!errorProjectNumber) return true;
  return errorProjectNumber === INBOXFLOW_GCP_PROJECT_NUMBER;
}

/** Client ID prefix must match InboxFlow project number (e.g. 505199243507-xxx.apps.googleusercontent.com). */
export function assertInboxflowOAuthClientConfigured(): void {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const prefix = clientId.split("-")[0] ?? "";
  if (prefix === INBOXFLOW_GCP_PROJECT_NUMBER) return;

  if (prefix === "1012921681881") {
    throw new Error(
      "Server is still using the old Google OAuth client (project 1012921681881). " +
        "Stop npm run dev completely, start it again, then Integrations → Gmail → Disconnect → Connect."
    );
  }

  throw new Error(
    `GOOGLE_CLIENT_ID must start with ${INBOXFLOW_GCP_PROJECT_NUMBER}- (InboxFlow). ` +
      `Restart npm run dev after updating .env, then reconnect Gmail.`
  );
}
