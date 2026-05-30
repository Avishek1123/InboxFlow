import { google } from "googleapis";
import { getGoogleOAuthConfig } from "@/lib/gmail/config";
import { createOAuthState } from "@/lib/gmail/oauth-state";

export function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGmailConnectUrl(organizationId: string, userId: string) {
  const { scopes } = getGoogleOAuthConfig();
  const client = createOAuth2Client();
  const state = createOAuthState(organizationId, userId);

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = await oauth2.userinfo.get();

  return {
    tokens,
    email: profile.data.email ?? "",
    googleId: profile.data.id ?? "",
  };
}
