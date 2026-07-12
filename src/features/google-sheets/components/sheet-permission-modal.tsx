"use client";

import { useCallback, useEffect, useState } from "react";
import { sheetExportClient } from "@/services/sheet-export-client";

type Props = {
  exportId: string;
  reconnectUrl: string;
  /** Auto-start Google OAuth + install (end-to-end, no sheet menu). */
  autoStart?: boolean;
  onDone: (message: string) => void;
  onCancel: () => void;
};

/**
 * Finishes product auto-sync inside InboxFlow — user never opens the sheet menu.
 * Flow: Google OAuth popup → install Apps Script timer via API.
 */
export function SheetPermissionModal({
  exportId,
  reconnectUrl,
  autoStart = true,
  onDone,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(
    "Finishing your product — connecting Google…"
  );

  const finishTrigger = useCallback(async () => {
    setBusy(true);
    setStatus("Installing 1-minute auto-sync on your sheet…");
    try {
      const first = await sheetExportClient.installTrigger(exportId, {
        repairOnly: false,
      });
      if (first.triggerInstalled) {
        onDone(
          first.message ||
            "Auto-sync is on. Starred emails will update your sheet every minute."
        );
        return;
      }

      await new Promise((r) => setTimeout(r, 2500));
      for (let i = 0; i < 4; i++) {
        setStatus(`Almost done — retrying auto-sync install (${i + 1}/4)…`);
        const res = await sheetExportClient.installTrigger(exportId, {
          repairOnly: true,
        });
        if (res.triggerInstalled) {
          onDone(
            res.message ||
              "Auto-sync enabled. Your product will update the sheet on its own."
          );
          return;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }

      if (first.reason === "authorization" || first.reason === "gcp_project") {
        setStatus(
          "Google needs one more approval. Click Continue with Google, allow all checkboxes, then we’ll finish automatically."
        );
        return;
      }

      onDone(
        first.message ||
          "Setup saved. Click Continue with Google once more if the timer is not on yet."
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }, [exportId, onDone]);

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
      "In the Google popup: check every permission box, then Continue. We’ll turn on auto-sync automatically — you don’t need to open the sheet."
    );
  }

  useEffect(() => {
    if (!autoStart) return;
    const t = window.setTimeout(() => openGooglePermissions(), 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once on mount
  }, [autoStart]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; ok?: boolean; message?: string };
      if (data?.type !== "inboxflow-gmail-oauth") return;
      if (data.ok) {
        void finishTrigger();
      } else {
        setStatus(data.message ?? "Google permissions were not granted.");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [finishTrigger]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-labelledby="sheet-permission-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
        <h2 id="sheet-permission-title" className="text-lg font-semibold">
          Finishing your product
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          One Google approval turns on the 1-minute sheet timer (starred Gmail → AI →
          your sheet). No need to open the spreadsheet or click any sheet menu.
        </p>
        {status && (
          <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">{status}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
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
