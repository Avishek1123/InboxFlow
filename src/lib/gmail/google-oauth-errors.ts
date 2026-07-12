/** Steps shown when Google OAuth tokens must be re-issued. */
export const GMAIL_OAUTH_RECONNECT_STEPS =
  "Remove InboxFlow at https://myaccount.google.com/permissions, then Integrations → Gmail → Disconnect → Connect again.";

export function gmailOAuthReconnectMessage(reason: string): string {
  return `${reason} ${GMAIL_OAUTH_RECONNECT_STEPS}`;
}

/** OAuth error code from a Google token refresh failure (Gaxios / google-auth-library). */
export function getGoogleOAuthErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const o = err as {
    message?: string;
    response?: { data?: { error?: string } };
    cause?: { message?: string };
  };
  const fromBody = o.response?.data?.error;
  if (typeof fromBody === "string") return fromBody;
  const msg = o.message ?? "";
  if (msg.includes("unauthorized_client")) return "unauthorized_client";
  if (msg.includes("invalid_grant")) return "invalid_grant";
  const causeMsg = o.cause?.message ?? "";
  if (causeMsg.includes("unauthorized_client")) return "unauthorized_client";
  if (causeMsg.includes("invalid_grant")) return "invalid_grant";
  return null;
}

export function messageFromGoogleOAuthRefreshError(err: unknown): string {
  const code = getGoogleOAuthErrorCode(err);
  if (code === "unauthorized_client") {
    return gmailOAuthReconnectMessage(
      "Gmail cannot refresh tokens: your saved refresh token does not match the OAuth client in .env " +
        "(often still from the old Google app, or GOOGLE_CLIENT_SECRET does not match GOOGLE_CLIENT_ID in Google Cloud). " +
        "In Google Cloud → InboxFlow → Credentials, confirm the client secret matches GOOGLE_CLIENT_ID, update .env, restart npm run dev."
    );
  }
  if (code === "invalid_grant") {
    return gmailOAuthReconnectMessage(
      "Gmail refresh token is invalid or revoked."
    );
  }
  return err instanceof Error ? err.message : String(err);
}

/** User-facing messages that mean Gmail must be disconnected and reconnected. */
export function isGmailOAuthReconnectMessage(message: string): boolean {
  return (
    message.includes("myaccount.google.com/permissions") ||
    message.includes("invalid_grant") ||
    message.includes("unauthorized_client") ||
    message.includes("last connected with Google Cloud project") ||
    message.includes("Gmail was last connected") ||
    message.includes("issued for Google Cloud project") ||
    message.includes("GOOGLE_CLIENT_ID is tied") ||
    message.includes("not InboxFlow") ||
    message.includes("old Google OAuth client") ||
    message.includes("cannot refresh tokens") ||
    message.includes("refresh token is invalid")
  );
}
