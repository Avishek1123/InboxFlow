"use client";

import { useCallback, useEffect, useState } from "react";
import { sheetExportClient } from "@/services/sheet-export-client";

type Props = {
  exportId: string;
  reconnectUrl: string;
  /** Apps Script web app that installs the time trigger after user authorizes. */
  webAppUrl?: string | null;
  /** Auto-start Google OAuth + install (end-to-end, no sheet menu). */
  autoStart?: boolean;
  onDone: (result: { installed: boolean; message: string }) => void;
  onCancel: () => void;
};

/**
 * Finishes product auto-sync inside InboxFlow.
 * 1) Google OAuth (scopes)
 * 2) Push Apps Script + try scripts.run
 * 3) If needed, open web app URL once so the user authorizes ScriptApp timers
 */
export function SheetPermissionModal({
  exportId,
  reconnectUrl,
  webAppUrl: initialWebAppUrl,
  autoStart = true,
  onDone,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [webAppUrl, setWebAppUrl] = useState<string | null>(
    initialWebAppUrl ?? null
  );
  const [status, setStatus] = useState<string | null>(
    "Finishing your product — connecting Google…"
  );

  const openWebAppAuth = useCallback((url: string) => {
    const w = 560;
    const h = 720;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(
      url,
      "inboxflow-apps-script-auth",
      `width=${w},height=${h},left=${left},top=${top}`
    );
    setStatus(
      "In the Google window: click Allow / Review permissions. That turns on the 1‑minute sheet sync timer."
    );
  }, []);

  const pollUntilInstalled = useCallback(async () => {
    for (let i = 0; i < 8; i++) {
      setStatus(`Checking Apps Script timer (${i + 1}/8)…`);
      const res = await sheetExportClient.installTrigger(exportId, {
        repairOnly: true,
      });
      if (res.webAppUrl) setWebAppUrl(res.webAppUrl);
      if (res.triggerInstalled) {
        onDone({
          installed: true,
          message:
            res.message ||
            "Auto-sync enabled. Your sheet updates every minute via Apps Script.",
        });
        return true;
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
    return false;
  }, [exportId, onDone]);

  const finishTrigger = useCallback(async () => {
    setBusy(true);
    setStatus("Installing Apps Script auto-sync on your sheet…");
    try {
      const first = await sheetExportClient.installTrigger(exportId, {
        repairOnly: false,
      });
      if (first.webAppUrl) setWebAppUrl(first.webAppUrl);

      if (first.triggerInstalled) {
        onDone({
          installed: true,
          message:
            first.message ||
            "Auto-sync is on. Starred emails will update your sheet every minute.",
        });
        return;
      }

      const url = first.webAppUrl || webAppUrl || initialWebAppUrl;
      if (url) {
        openWebAppAuth(url);
        const ok = await pollUntilInstalled();
        if (ok) return;
        setStatus(
          "Timer not confirmed yet. Click “Open Apps Script approval” again, allow all permissions, then Retry."
        );
        return;
      }

      let reason = first.reason ?? null;
      for (let i = 0; i < 3; i++) {
        setStatus(`Retrying auto-sync install (${i + 1}/3)…`);
        const res = await sheetExportClient.installTrigger(exportId, {
          repairOnly: true,
        });
        if (res.webAppUrl) setWebAppUrl(res.webAppUrl);
        if (res.triggerInstalled) {
          onDone({
            installed: true,
            message:
              res.message ||
              "Auto-sync enabled. Your product will update the sheet on its own.",
          });
          return;
        }
        if (res.reason) reason = res.reason;
        if (res.webAppUrl) {
          openWebAppAuth(res.webAppUrl);
          const ok = await pollUntilInstalled();
          if (ok) return;
        }
        await new Promise((r) => setTimeout(r, 2500));
      }

      if (reason === "authorization") {
        setStatus(
          "Google needs approval. Click Continue with Google, allow all checkboxes, then we’ll finish automatically."
        );
        return;
      }

      onDone({
        installed: false,
        message:
          first.message ||
          "Could not install the Apps Script timer. Try again.",
      });
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }, [
    exportId,
    initialWebAppUrl,
    onDone,
    openWebAppAuth,
    pollUntilInstalled,
    webAppUrl,
  ]);

  function openGooglePermissions() {
    setStatus(null);
    const w = 520;
    const h = 720;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const url = new URL(reconnectUrl, window.location.origin);
    url.searchParams.set("popup", "1");
    url.searchParams.set("openerOrigin", window.location.origin);
    window.open(
      url.toString(),
      "inboxflow-google-permissions",
      `width=${w},height=${h},left=${left},top=${top}`
    );
    setStatus(
      "In the Google popup: check every permission box, then Continue."
    );
  }

  useEffect(() => {
    if (!autoStart) return;
    // If we already have a web app URL, prefer that path immediately.
    if (initialWebAppUrl) {
      const t = window.setTimeout(() => {
        openWebAppAuth(initialWebAppUrl);
        void (async () => {
          setBusy(true);
          try {
            const ok = await pollUntilInstalled();
            if (!ok) {
              setStatus(
                "Approve the Google window, then click Retry install."
              );
            }
          } finally {
            setBusy(false);
          }
        })();
      }, 400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => openGooglePermissions(), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once on mount
  }, [autoStart]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as {
        type?: string;
        ok?: boolean;
        message?: string;
        triggerCount?: number;
      };
      if (data?.type === "inboxflow-apps-script-auth") {
        if (data.ok) {
          void (async () => {
            setBusy(true);
            try {
              const ok = await pollUntilInstalled();
              if (!ok) {
                onDone({
                  installed: true,
                  message:
                    "Apps Script authorization finished. Auto-sync timer should be on.",
                });
              }
            } finally {
              setBusy(false);
            }
          })();
        } else {
          setStatus(data.message ?? "Apps Script approval failed.");
        }
        return;
      }
      if (data?.type !== "inboxflow-gmail-oauth") return;
      if (data.ok) {
        void finishTrigger();
      } else {
        setStatus(data.message ?? "Google permissions were not granted.");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [finishTrigger, onDone, pollUntilInstalled]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="sheet-permission-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Final step · Website only
        </p>
        <h2 id="sheet-permission-title" className="mt-2 text-xl font-semibold tracking-tight">
          Activate 1‑minute sheet sync
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Approve Google here. We install Apps Script on your sheet so starred
          Gmail → AI → sheet every minute. You never open a sheet menu.
        </p>
        {status && (
          <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">{status}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {(webAppUrl || initialWebAppUrl) && (
            <button
              type="button"
              onClick={() =>
                openWebAppAuth((webAppUrl || initialWebAppUrl) as string)
              }
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Open Apps Script approval
            </button>
          )}
          <button
            type="button"
            onClick={openGooglePermissions}
            disabled={busy}
            className="rounded-lg bg-[#0F9D58] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => void finishTrigger()}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {busy ? "Installing…" : "Retry install"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
