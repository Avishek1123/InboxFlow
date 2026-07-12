export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDevTunnelIfEnabled } = await import("@/server/dev-tunnel");
    await startDevTunnelIfEnabled();
    const { startSheetKeepAliveWorker } = await import(
      "@/server/google-sheets/sheet-keepalive"
    );
    startSheetKeepAliveWorker();
  }
}
