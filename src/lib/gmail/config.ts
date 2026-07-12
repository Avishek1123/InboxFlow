import { GOOGLE_SHEETS_SCOPES } from "@/lib/gmail/scopes";

const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  ...GOOGLE_SHEETS_SCOPES,
];

/** Env scopes are merged in — Sheets scopes are always included. */
export function getGoogleOAuthScopes(): string[] {
  const scopesRaw = process.env.GOOGLE_GMAIL_SCOPES;
  const fromEnv = scopesRaw
    ? scopesRaw.replace(/^"|"$/g, "").split(/\s+/).filter(Boolean)
    : [];
  return [...new Set([...DEFAULT_SCOPES, ...fromEnv])];
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/integrations/gmail/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: getGoogleOAuthScopes(),
  };
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export function getGmailSyncConfig() {
  const batchSize = Number(process.env.GMAIL_SYNC_BATCH_SIZE ?? 50);
  const backfillMax = Number(process.env.GMAIL_SYNC_BACKFILL_MAX ?? 500);
  return {
    batchSize,
    /** Max messages fetched per sync from Gmail search (starred, inbox, etc.). */
    backfillMax: Math.max(batchSize, backfillMax),
    lockTtlMinutes: Number(process.env.GMAIL_SYNC_LOCK_TTL_MINUTES ?? 15),
  };
}
