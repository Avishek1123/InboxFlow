import type { ConnectedAccount } from "@prisma/client";
import { INBOXFLOW_GCP_PROJECT_NUMBER } from "@/lib/gmail/inboxflow-gcp";
import {
  currentOAuthProjectNumber,
  getStoredOAuthProjectNumber,
} from "@/lib/gmail/oauth-metadata";
import {
  getGoogleOAuthErrorCode,
} from "@/lib/gmail/google-oauth-errors";
import { createOAuth2Client } from "@/server/gmail/oauth";
import { getAccessTokenClientId } from "@/server/google/verify-access-token";
import { gmailRepository } from "@/server/repositories/gmail.repository";

function accessTokenStillValid(account: ConnectedAccount): boolean {
  if (!account.tokenExpiresAt) return false;
  return account.tokenExpiresAt.getTime() > Date.now() + 60_000;
}

export type GmailTokenHealth = {
  /** Access token aud is not the InboxFlow OAuth client in .env */
  legacyOAuthToken: boolean;
  /** Project number from tokeninfo aud prefix (e.g. 1012921681881) */
  legacyOAuthProject: string | null;
  /** Stored metadata oauthProjectNumber differs from current .env client */
  storedProjectMismatch: boolean;
  needsReconnect: boolean;
  /** Refresh token probe failed (invalid_grant / unauthorized_client) */
  refreshTokenInvalid: boolean;
  reconnectMessage: string | null;
};

export async function getGmailTokenHealth(
  account: ConnectedAccount | null
): Promise<GmailTokenHealth> {
  if (!account) {
    return {
      legacyOAuthToken: false,
      legacyOAuthProject: null,
      storedProjectMismatch: false,
      needsReconnect: false,
      refreshTokenInvalid: false,
      reconnectMessage: null,
    };
  }

  if (account.status === "TOKEN_EXPIRED") {
    return {
      legacyOAuthToken: false,
      legacyOAuthProject: null,
      storedProjectMismatch: false,
      needsReconnect: true,
      refreshTokenInvalid: true,
      reconnectMessage: account.syncError,
    };
  }

  if (account.status !== "ACTIVE") {
    return {
      legacyOAuthToken: false,
      legacyOAuthProject: null,
      storedProjectMismatch: false,
      needsReconnect: false,
      refreshTokenInvalid: false,
      reconnectMessage: null,
    };
  }

  const meta =
    typeof account.metadata === "object" &&
    account.metadata !== null &&
    !Array.isArray(account.metadata)
      ? (account.metadata as Record<string, unknown>)
      : {};
  // Stale flag: upsertFromOAuth used to leave reconnectRequired=true while
  // setting status ACTIVE. Only honor it when the account is still expired.
  if (meta.reconnectRequired === true && account.status !== "ACTIVE") {
    return {
      legacyOAuthToken: false,
      legacyOAuthProject: null,
      storedProjectMismatch: false,
      needsReconnect: true,
      refreshTokenInvalid: true,
      reconnectMessage: account.syncError,
    };
  }

  const expectedClientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const stored = getStoredOAuthProjectNumber(account.metadata);
  const current = currentOAuthProjectNumber();
  const storedProjectMismatch = Boolean(
    stored && current && stored !== current
  );

  let legacyOAuthToken = false;
  let legacyOAuthProject: string | null = null;

  if (expectedClientId && account.encryptedAccessToken) {
    try {
      const { accessToken } = await gmailRepository.getDecryptedTokens(account);
      const aud = await getAccessTokenClientId(accessToken);
      if (aud && aud !== expectedClientId) {
        legacyOAuthToken = true;
        legacyOAuthProject = aud.split("-")[0] ?? null;
      }
    } catch {
      /* ignore decrypt errors */
    }
  }

  let refreshTokenInvalid = false;
  let reconnectMessage: string | null = null;

  if (
    !legacyOAuthToken &&
    !storedProjectMismatch &&
    account.encryptedRefreshToken &&
    !accessTokenStillValid(account)
  ) {
    try {
      const { refreshToken } = await gmailRepository.getDecryptedTokens(account);
      const auth = createOAuth2Client();
      auth.setCredentials({ refresh_token: refreshToken });
      await auth.refreshAccessToken();
    } catch (err) {
      const code = getGoogleOAuthErrorCode(err);
      if (code === "invalid_grant" || code === "unauthorized_client") {
        refreshTokenInvalid = true;
        reconnectMessage =
          account.syncError ??
          "Gmail refresh token is invalid or revoked. Disconnect and connect again.";
      }
    }
  }

  const needsReconnect =
    legacyOAuthToken ||
    storedProjectMismatch ||
    legacyOAuthProject === "1012921681881" ||
    refreshTokenInvalid;

  return {
    legacyOAuthToken,
    legacyOAuthProject,
    storedProjectMismatch,
    needsReconnect,
    refreshTokenInvalid,
    reconnectMessage,
  };
}

export function legacyOAuthBannerMessage(legacyProject: string | null): string {
  const project = legacyProject ?? "another";
  return (
    `Gmail is still authorized with Google Cloud project ${project}, not InboxFlow (${INBOXFLOW_GCP_PROJECT_NUMBER}). ` +
    `Remove InboxFlow at https://myaccount.google.com/permissions, click Disconnect below, then Connect Gmail again.`
  );
}
