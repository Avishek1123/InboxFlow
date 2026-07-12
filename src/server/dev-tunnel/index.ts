let tunnelUrl: string | null = null;
let tunnelProvider: "ngrok" | "localtunnel" | null = null;
let startPromise: Promise<string | null> | null = null;
let activeTunnel: { close?: () => void } | null = null;

export function getDevTunnelUrl(): string | null {
  return tunnelUrl;
}

export function getDevTunnelProvider(): typeof tunnelProvider {
  return tunnelProvider;
}

function devTunnelEnabled(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.DEV_TUNNEL_AUTO === "false") return false;
  // Always start a tunnel in dev when possible. A static NEXT_PUBLIC_APP_URL in .env
  // (e.g. yesterday's ngrok URL) must not block a fresh tunnel — that causes 503s.
  return true;
}

function resolvePort(): number {
  const raw = process.env.PORT ?? process.env.NEXT_PUBLIC_DEV_PORT ?? "3000";
  const port = Number(raw);
  return Number.isFinite(port) && port > 0 ? port : 3000;
}

async function startNgrok(port: number): Promise<string | null> {
  const token = process.env.NGROK_AUTHTOKEN?.trim();
  if (!token) return null;

  try {
    const ngrok = await import("@ngrok/ngrok");
    const listener = await ngrok.forward({
      addr: port,
      authtoken: token,
      domain: process.env.NGROK_DOMAIN?.trim() || undefined,
    });
    const url = listener.url()?.replace(/\/$/, "") ?? null;
    if (url) {
      tunnelProvider = "ngrok";
      activeTunnel = { close: () => listener.close() };
      return url;
    }
  } catch (err) {
    console.warn("[dev-tunnel] ngrok failed:", err);
  }
  return null;
}

async function startLocaltunnel(port: number): Promise<string | null> {
  try {
    const { default: localtunnel } = await import("localtunnel");
    const tunnel = await localtunnel({ port });
    const url = tunnel.url?.replace(/\/$/, "") ?? null;
    if (!url) return null;

    tunnel.on("close", () => {
      if (tunnelUrl === url) {
        tunnelUrl = null;
        tunnelProvider = null;
        activeTunnel = null;
        delete process.env.DEV_PUBLIC_APP_URL;
      }
    });

    tunnelProvider = "localtunnel";
    activeTunnel = tunnel;
    return url;
  } catch (err) {
    console.warn("[dev-tunnel] localtunnel failed:", err);
  }
  return null;
}

async function persistTunnelUrlToEnvLocal(url: string): Promise<void> {
  if (process.env.DEV_TUNNEL_WRITE_ENV === "false") return;

  const fs = await import("fs/promises");
  const path = await import("path");
  const envPath = path.join(process.cwd(), ".env.local");
  // Do NOT write NEXT_PUBLIC_APP_URL — Next loads that at boot and keeps a dead
  // ngrok host after restart. Persist only for humans / debugging.
  const line = `DEV_PUBLIC_APP_URL=${url}`;
  const key = "DEV_PUBLIC_APP_URL=";
  const stalePublicKey = "NEXT_PUBLIC_APP_URL=";

  let content = "";
  try {
    content = await fs.readFile(envPath, "utf8");
  } catch {
    content = "";
  }

  const lines = content.length ? content.split(/\r?\n/) : [];
  let found = false;
  const next: string[] = [];
  for (const l of lines) {
    if (
      l.startsWith(stalePublicKey) &&
      (l.includes("ngrok") || l.includes("loca.lt") || l.includes("localtunnel"))
    ) {
      next.push("# cleared-stale-tunnel NEXT_PUBLIC_APP_URL (ephemeral)");
      continue;
    }
    if (l.startsWith(key)) {
      found = true;
      next.push(line);
      continue;
    }
    next.push(l);
  }

  if (!found) {
    if (next.length && next[next.length - 1] !== "") next.push("");
    next.push("# Auto-set by InboxFlow dev tunnel (not loaded as NEXT_PUBLIC_*)");
    next.push(line);
  }

  await fs.writeFile(envPath, next.join("\n") + "\n", "utf8");
}

function logTunnelReady(url: string, provider: string): void {
  console.info("");
  console.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.info(`[dev-tunnel] Public URL (${provider}) for Google Apps Script:`);
  console.info(`  ${url}`);
  console.info("  Sheet triggers will call this URL (not localhost).");
  if (provider === "localtunnel") {
    console.info(
      "  Tip: set NGROK_AUTHTOKEN in .env for a more stable ngrok URL."
    );
  }
  console.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.info("");
}

/** Drop cached tunnel so the next start creates a fresh public URL. */
export async function resetDevTunnel(): Promise<string | null> {
  try {
    activeTunnel?.close?.();
  } catch {
    /* ignore */
  }
  activeTunnel = null;
  tunnelUrl = null;
  tunnelProvider = null;
  startPromise = null;
  delete process.env.DEV_PUBLIC_APP_URL;
  return startDevTunnelIfEnabled();
}

/** Start a temporary HTTPS tunnel in local dev (ngrok if token set, else localtunnel). */
export async function startDevTunnelIfEnabled(): Promise<string | null> {
  if (!devTunnelEnabled()) return null;
  if (tunnelUrl) return tunnelUrl;
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const port = resolvePort();
    const ngrokToken = process.env.NGROK_AUTHTOKEN?.trim();
    let url: string | null = null;

    if (ngrokToken) {
      url = await startNgrok(port);
      if (!url) {
        console.error(
          "[dev-tunnel] NGROK_AUTHTOKEN is set but ngrok failed to start. " +
            "Check the token at https://dashboard.ngrok.com/get-started/your-authtoken"
        );
      }
    } else if (process.env.DEV_TUNNEL_LOCALTUNNEL !== "false") {
      url = await startLocaltunnel(port);
    }

    if (!url) {
      console.warn(
        "[dev-tunnel] No tunnel started. Set NGROK_AUTHTOKEN (free at https://ngrok.com) " +
          "for a stable URL, or allow localtunnel. Sheet auto-sync needs a reachable public URL."
      );
      return null;
    }

    tunnelUrl = url;
    process.env.DEV_PUBLIC_APP_URL = url;

    try {
      await persistTunnelUrlToEnvLocal(url);
    } catch (err) {
      console.warn("[dev-tunnel] Could not update .env.local:", err);
    }

    logTunnelReady(url, tunnelProvider ?? "tunnel");
    return url;
  })();

  return startPromise;
}
