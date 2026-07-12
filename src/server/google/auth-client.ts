import { google } from "googleapis";
import type { ConnectedAccount } from "@prisma/client";
import { createOAuth2Client } from "@/server/gmail/oauth";
import { gmailRepository } from "@/server/repositories/gmail.repository";

export async function getGoogleAuthClientForAccount(account: ConnectedAccount) {
  const { accessToken, refreshToken } =
    await gmailRepository.getDecryptedTokens(account);

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
    expiry_date: account.tokenExpiresAt?.getTime(),
  });

  client.on("tokens", async (tokens) => {
    if (!tokens.access_token) return;
    const { encryptSecret } = await import("@/lib/crypto/tokens");
    await gmailRepository.updateSyncState(account.id, {
      encryptedAccessToken: encryptSecret(tokens.access_token),
      tokenExpiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : undefined,
      ...(tokens.refresh_token
        ? { encryptedRefreshToken: encryptSecret(tokens.refresh_token) }
        : {}),
    });
  });

  return client;
}

export async function getGoogleAuthClientForOrganization(organizationId: string) {
  const account = await gmailRepository.findGmailAccount(organizationId);
  if (!account || account.status !== "ACTIVE") {
    throw new Error(
      "Connect Gmail first using the same Google account you want for Sheets."
    );
  }
  return { auth: await getGoogleAuthClientForAccount(account), account };
}
