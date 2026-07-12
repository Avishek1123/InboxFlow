/** Returns OAuth client ID (aud) the access token was issued for. */
export async function getAccessTokenClientId(
  accessToken: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { aud?: string; azp?: string };
    return data.aud ?? data.azp ?? null;
  } catch {
    return null;
  }
}

export function accessTokenClientMismatchMessage(
  tokenClientId: string,
  expectedClientId: string
): string {
  const tokenProject = tokenClientId.split("-")[0];
  const expectedProject = expectedClientId.split("-")[0];
  return (
    `Your Gmail token was issued for Google Cloud project ${tokenProject}, not InboxFlow (${expectedProject}). ` +
    `Remove the app at https://myaccount.google.com/permissions, then Integrations → Gmail → Disconnect → Connect.`
  );
}
