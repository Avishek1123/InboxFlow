const HEALTH_PATH = "/api/v1/sheet-sync/health";

export type PublicUrlCheck = {
  ok: boolean;
  status?: number;
  detail?: string;
};

/** Same headers Apps Script uses so localtunnel does not return 503 HTML. */
export async function verifyPublicUrlReachable(
  baseUrl: string
): Promise<PublicUrlCheck> {
  const url = `${baseUrl.replace(/\/$/, "")}${HEALTH_PATH}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Bypass-Tunnel-Reminder": "true",
        "ngrok-skip-browser-warning": "1",
        "User-Agent": "InboxFlow-HealthCheck/1",
      },
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.text()).slice(0, 500);
    const isHtml =
      body.includes("<!DOCTYPE") ||
      body.includes("<html") ||
      body.includes("ngrok.com");
    if (!res.ok) {
      if (body.includes("Sign in required") || body.includes("UNAUTHORIZED")) {
        return {
          ok: false,
          status: res.status,
          detail:
            "Health endpoint blocked by auth middleware — restart dev server after update",
        };
      }
      if (body.includes("Tunnel Unavailable") || res.status === 503) {
        return {
          ok: false,
          status: res.status,
          detail:
            "Tunnel offline or stale URL — restart npm run dev, then click Update script on this page",
        };
      }
      if (isHtml) {
        return {
          ok: false,
          status: res.status,
          detail:
            "Tunnel returned an HTML page instead of the API — restart dev server and Update script",
        };
      }
      return {
        ok: false,
        status: res.status,
        detail: body.slice(0, 120) || res.statusText,
      };
    }
    if (!body.includes('"ok":true') && !body.includes('"ok": true')) {
      if (body.includes("Sign in required") || body.includes("UNAUTHORIZED")) {
        return {
          ok: false,
          status: res.status,
          detail: "Sheet sync API requires public access — pull latest code and restart dev",
        };
      }
      if (isHtml) {
        return {
          ok: false,
          status: res.status,
          detail:
            "ngrok interstitial or offline — restart npm run dev, then Update script with the new URL",
        };
      }
      return { ok: false, status: res.status, detail: "Unexpected health response" };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function tunnelUnavailableMessage(provider: string | null): string {
  if (provider === "localtunnel") {
    return (
      "localtunnel is down. Add NGROK_AUTHTOKEN to .env, restart npm run dev, then Update script. " +
      "Use Sync now on this page anytime — it does not need the tunnel."
    );
  }
  if (provider === "ngrok") {
    return (
      "ngrok URL is not reachable. Restart npm run dev (watch terminal for the new URL), " +
      "then Update script. Remove a fixed ngrok URL from .env if you added one. " +
      "Sync now on this page works without the tunnel."
    );
  }
  return (
    "Public URL is not reachable. Restart npm run dev, then Update script. " +
    "Use Sync now on this page — it does not need the tunnel."
  );
}
