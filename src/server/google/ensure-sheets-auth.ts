import type { ConnectedAccount, Prisma } from "@prisma/client";
import type { OAuth2Client } from "google-auth-library";
import {
  getStoredOAuthProjectNumber,
  mergeOAuthMetadata,
  oauthProjectMismatchMessage,
  currentOAuthProjectNumber,
} from "@/lib/gmail/oauth-metadata";
import {
  getGoogleOAuthErrorCode,
  gmailOAuthReconnectMessage,
  messageFromGoogleOAuthRefreshError,
} from "@/lib/gmail/google-oauth-errors";
import { createOAuth2Client } from "@/server/gmail/oauth";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import {
  accessTokenClientMismatchMessage,
  getAccessTokenClientId,
} from "@/server/google/verify-access-token";

function accessTokenStillValid(account: ConnectedAccount): boolean {
  if (!account.tokenExpiresAt) return false;
  return account.tokenExpiresAt.getTime() > Date.now() + 60_000;
}

/**
 * Refresh tokens with the current GOOGLE_CLIENT_ID/SECRET and verify the access
 * token belongs to this OAuth client (not a legacy 1012921681881 app).
 */
export async function ensureSheetsOAuthClient(
  account: ConnectedAccount
): Promise<OAuth2Client> {
  const expectedClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!expectedClientId) {
    throw new Error("GOOGLE_CLIENT_ID is not set in .env");
  }

  const expectedProject = currentOAuthProjectNumber();
  const storedProject = getStoredOAuthProjectNumber(account.metadata);
  if (storedProject && expectedProject && storedProject !== expectedProject) {
    throw new Error(oauthProjectMismatchMessage(storedProject));
  }

  const { accessToken, refreshToken } =
    await gmailRepository.getDecryptedTokens(account);

  if (!refreshToken) {
    throw new Error(
      gmailOAuthReconnectMessage("Gmail has no refresh token.")
    );
  }

  const tokenClientId = await getAccessTokenClientId(accessToken);
  if (tokenClientId && tokenClientId !== expectedClientId) {
    throw new Error(
      accessTokenClientMismatchMessage(tokenClientId, expectedClientId)
    );
  }

  const auth = createOAuth2Client();
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.tokenExpiresAt?.getTime(),
  });

  if (accessTokenStillValid(account)) {
    return auth;
  }

  try {
    const { credentials } = await auth.refreshAccessToken();
    auth.setCredentials(credentials);

    if (credentials.access_token) {
      const { encryptSecret } = await import("@/lib/crypto/tokens");
      await gmailRepository.updateSyncState(account.id, {
        encryptedAccessToken: encryptSecret(credentials.access_token),
        tokenExpiresAt: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : undefined,
        ...(credentials.refresh_token
          ? { encryptedRefreshToken: encryptSecret(credentials.refresh_token) }
          : {}),
        metadata: mergeOAuthMetadata(
          account.metadata,
          currentOAuthProjectNumber()
        ) as Prisma.InputJsonValue,
      });
    }
  } catch (err) {
    const code = getGoogleOAuthErrorCode(err);
    if (code === "unauthorized_client" || code === "invalid_grant") {
      const message = messageFromGoogleOAuthRefreshError(err);
      await gmailRepository.markReconnectRequired(account.id, message);
      throw new Error(message);
    }
    throw err;
  }

  const refreshedClientId = await getAccessTokenClientId(
    auth.credentials.access_token ?? accessToken
  );
  if (refreshedClientId && refreshedClientId !== expectedClientId) {
    throw new Error(
      accessTokenClientMismatchMessage(refreshedClientId, expectedClientId)
    );
  }

  return auth;
}
