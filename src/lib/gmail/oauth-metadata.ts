import { INBOXFLOW_GCP_PROJECT_NUMBER } from "@/lib/gmail/inboxflow-gcp";

const OAUTH_PROJECT_KEY = "oauthProjectNumber";

export function currentOAuthProjectNumber(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim().split("-")[0] ?? "";
}

export function mergeOAuthMetadata(
  existing: unknown,
  oauthProjectNumber: string
): Record<string, unknown> {
  const base =
    typeof existing === "object" && existing !== null && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  base[OAUTH_PROJECT_KEY] = oauthProjectNumber;
  // Successful OAuth must clear a prior invalid_grant / reconnect flag.
  delete base.reconnectRequired;
  return base;
}

export function getStoredOAuthProjectNumber(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return null;
  }
  const v = (metadata as Record<string, unknown>)[OAUTH_PROJECT_KEY];
  return typeof v === "string" ? v : null;
}

export function oauthProjectMismatchMessage(stored: string): string {
  return (
    `Gmail was last connected with Google Cloud project ${stored}, but this app now uses InboxFlow (${INBOXFLOW_GCP_PROJECT_NUMBER}). ` +
    `Go to Integrations → Gmail → Disconnect, then Connect again (you may need to remove InboxFlow at ` +
    `https://myaccount.google.com/permissions first).`
  );
}
