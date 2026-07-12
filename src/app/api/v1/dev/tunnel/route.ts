import { apiError, apiSuccess } from "@/lib/api-response";
import { getPublicAppBaseUrl, isLocalAppUrl } from "@/lib/app-url";
import {
  getDevTunnelProvider,
  getDevTunnelUrl,
  resetDevTunnel,
  startDevTunnelIfEnabled,
} from "@/server/dev-tunnel";
import { ensureHealthyPublicAppUrl } from "@/server/dev-tunnel/ensure-healthy-public-url";

export const runtime = "nodejs";

/** Dev-only: current public URL used for Apps Script (tunnel or env). */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return apiError("NOT_FOUND", "Only available in development", 404);
  }

  const requestOrigin = new URL(request.url).origin;
  let health = await ensureHealthyPublicAppUrl(requestOrigin);

  if (!health.reachable) {
    await resetDevTunnel();
    health = await ensureHealthyPublicAppUrl(requestOrigin);
  }

  const tunnelUrl = getDevTunnelUrl();
  const publicUrl = health.url;

  const configuredEnvUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const staleConfiguredUrl =
    Boolean(
      configuredEnvUrl &&
        !isLocalAppUrl(configuredEnvUrl) &&
        publicUrl &&
        configuredEnvUrl.replace(/\/$/, "") !== publicUrl.replace(/\/$/, "")
    );

  return apiSuccess({
    publicUrl,
    tunnelUrl,
    provider: health.provider ?? getDevTunnelProvider(),
    isPublic: !isLocalAppUrl(publicUrl),
    reachable: health.reachable,
    healthError: health.error,
    staleConfiguredUrl,
    configuredEnvUrl: staleConfiguredUrl ? configuredEnvUrl : undefined,
    hint: health.reachable
      ? "URL is reachable for Google Apps Script auto-sync."
      : health.error ??
        "Set NGROK_AUTHTOKEN in .env, restart npm run dev, then Update script.",
  });
}

/** Restart the dev tunnel and return the new public URL. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return apiError("NOT_FOUND", "Only available in development", 404);
  }

  const requestOrigin = new URL(request.url).origin;
  await resetDevTunnel();
  const health = await ensureHealthyPublicAppUrl(requestOrigin);

  return apiSuccess({
    publicUrl: health.url,
    tunnelUrl: getDevTunnelUrl(),
    provider: health.provider ?? getDevTunnelProvider(),
    reachable: health.reachable,
    healthError: health.error,
    hint: health.reachable
      ? "Tunnel restarted. Click Update script so the sheet uses this URL."
      : health.error ?? "Tunnel restart failed.",
  });
}
