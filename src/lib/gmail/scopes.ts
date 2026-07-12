/** Scopes required to create/sync Google Sheets from InboxFlow. */
export const GOOGLE_SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/script.projects",
  /** API executable deployments for scripts.run */
  "https://www.googleapis.com/auth/script.deployments",
  /** Run installInboxFlowTimeTrigger after sheet creation */
  "https://www.googleapis.com/auth/script.scriptapp",
] as const;

const SPREADSHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SCRIPT_PROJECTS_SCOPE = "https://www.googleapis.com/auth/script.projects";

/** True if the connected account was authorized for Sheets + Apps Script. */
export function hasGoogleSheetsScopes(granted: string[] | null | undefined): boolean {
  if (!granted?.length) return false;
  const hasSpreadsheets = granted.some(
    (s) => s === SPREADSHEETS_SCOPE || s.endsWith("/auth/spreadsheets")
  );
  const hasScript = granted.some(
    (s) =>
      s === SCRIPT_PROJECTS_SCOPE ||
      s.includes("script.projects") ||
      s.includes("script.deployments") ||
      s.includes("script.scriptapp")
  );
  return hasSpreadsheets && hasScript;
}

export const GMAIL_RECONNECT_FOR_SHEETS_MESSAGE =
  "Your Google account needs updated permissions for Sheets. Disconnect Gmail, then connect again and approve all requested access (including Google Sheets).";
