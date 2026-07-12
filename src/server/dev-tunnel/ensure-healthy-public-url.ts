import { getPublicAppBaseUrl, isEphemeralTunnelUrl, isLocalAppUrl } from "@/lib/app-url";
import {
  getDevTunnelProvider,
  getDevTunnelUrl,
  resetDevTunnel,
  startDevTunnelIfEnabled,
} from "@/server/dev-tunnel";
import {
  tunnelUnavailableMessage,
  verifyPublicUrlReachable,
} from "@/server/dev-tunnel/verify-public-url";

export type HealthyPublicUrlResult = {
  url: string;
  reachable: boolean;
  provider: ReturnType<typeof getDevTunnelProvider>;
  error?: string;
};

/** Ensure dev tunnel is up and reachable from the internet (for Apps Script). */
export async function ensureHealthyPublicAppUrl(
  requestOrigin?: string
): Promise<HealthyPublicUrlResult> {
  await startDevTunnelIfEnabled();
  let url = getPublicAppBaseUrl(requestOrigin);
  let provider = getDevTunnelProvider();

  // If we only have a stale env URL (no live tunnel), force a fresh tunnel.
  if (
    process.env.NODE_ENV === "development" &&
    !getDevTunnelUrl() &&
    isEphemeralTunnelUrl(url)
  ) {
    const fresh = await resetDevTunnel();
    if (fresh) {
      url = fresh;
      provider = getDevTunnelProvider();
    }
  }

  let check = await verifyPublicUrlReachable(url);
  if (!check.ok) {
    const newUrl = await resetDevTunnel();
    if (newUrl) {
      url = newUrl;
      provider = getDevTunnelProvider();
      check = await verifyPublicUrlReachable(url);
    }
  }

  if (!check.ok) {
    const staleEnv =
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_APP_URL &&
      !isLocalAppUrl(process.env.NEXT_PUBLIC_APP_URL) &&
      isEphemeralTunnelUrl(process.env.NEXT_PUBLIC_APP_URL) &&
      url !== process.env.DEV_PUBLIC_APP_URL?.replace(/\/$/, "");
    return {
      url,
      reachable: false,
      provider,
      error:
        check.detail ??
        (staleEnv
          ? "Stale tunnel URL in .env.local was ignored — restart npm run dev, click Restart tunnel, then Update script."
          : tunnelUnavailableMessage(provider) +
            (check.status ? ` (HTTP ${check.status})` : "")),
    };
  }

  return { url, reachable: true, provider };
}

export function assertHealthyPublicAppUrl(result: HealthyPublicUrlResult): void {
  if (result.reachable) return;
  throw new Error(result.error ?? tunnelUnavailableMessage(result.provider));
}
