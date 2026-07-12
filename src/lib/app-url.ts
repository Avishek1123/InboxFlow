/** Public app URL used by Google Apps Script (must be reachable from Google servers). */

/** Ephemeral tunnel hosts written by prior runs — never trust these from .env alone. */
export function isEphemeralTunnelUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith(".ngrok-free.app") ||
      host.endsWith(".ngrok-free.dev") ||
      host.endsWith(".ngrok.io") ||
      host.endsWith(".ngrok.app") ||
      host.endsWith(".loca.lt") ||
      host.endsWith(".localtunnel.me")
    );
  } catch {
    return false;
  }
}

export function getPublicAppBaseUrl(fallbackOrigin?: string): string {
  /** Live tunnel for this Node process (set by startDevTunnelIfEnabled). */
  const fromTunnel = process.env.DEV_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromTunnel && !isLocalAppUrl(fromTunnel)) return fromTunnel;

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  /**
   * In development, ignore stale ngrok/localtunnel URLs left in .env / .env.local.
   * Those die when the previous process exits and cause "HTML instead of API" errors.
   */
  if (
    fromEnv &&
    !isLocalAppUrl(fromEnv) &&
    !(process.env.NODE_ENV === "development" && isEphemeralTunnelUrl(fromEnv))
  ) {
    return fromEnv;
  }

  if (fromEnv && isLocalAppUrl(fromEnv)) return fromEnv;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");
  return "http://localhost:3000";
}

/** True when a live tunnel or stable public NEXT_PUBLIC_APP_URL is active. */
export function hasReachablePublicAppUrl(fallbackOrigin?: string): boolean {
  return !isLocalAppUrl(getPublicAppBaseUrl(fallbackOrigin));
}

export function isLocalAppUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}
