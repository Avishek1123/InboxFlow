"use client";

import { useCallback, useEffect, useState } from "react";
import { sheetExportClient } from "@/services/sheet-export-client";

type Props = {
  exportId: string;
  reconnectUrl: string;
  onDone: (message: string) => void;
  onCancel: () => void;
};

/**
 * Modal that appears when auto-sync still needs Google consent and a public API URL
 * in the sheet's Apps Script (fixes localhost DNS errors).
 */
export function SheetPermissionModal({
  exportId,
  reconnectUrl,
  onDone,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const finishTrigger = useCallback(async () => {
    setBusy(true);
    setStatus("Updating sheet script + installing auto-sync timer…");
    try {
      // repairOnly:false → push public HTTPS URL into Apps Script (replaces localhost).
      const first = await sheetExportClient.installTrigger(exportId, {
        repairOnly: false,
      });
      if (first.triggerInstalled) {
        onDone(first.message || "Auto-sync is on. Your sheet can sync from Google.");
        return;
      }

      await new Promise((r) => setTimeout(r, 3000));
      for (let i = 0; i < 2; i++) {
        const res = await sheetExportClient.installTrigger(exportId, {
          repairOnly: true,
        });
        if (res.triggerInstalled) {
          onDone(res.message || "Auto-sync enabled.");
          return;
        }
        if (i === 0) await new Promise((r) => setTimeout(r, 8000));
      }

      if (first.reason === "authorization") {
        setStatus(
          "Google still needs one more approval. Click Grant Google permissions, allow all scopes, then Check again."
        );
        return;
      }

      onDone(
        first.message ||
          "Script updated. If the timer is not on yet, click Grant Google permissions once more."
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }, [exportId, onDone]);

  useEffect(() => {
    const t = window.setTimeout(() => openGooglePermissions(), 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once on mount
  }, []);

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
      "In the Google popup: check all boxes, then Continue. We will enable auto-sync and fix the sheet API URL automatically."
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-labelledby="sheet-permission-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
        <h2 id="sheet-permission-title" className="text-lg font-semibold">
          Enable auto-sync
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Grant Google permission once so InboxFlow can install the sheet timer and
          replace any <code className="text-xs">localhost</code> URL (which causes DNS
          errors when syncing from the sheet).
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
            Grant Google permissions
          </button>
          <button
            type="button"
            onClick={() => void finishTrigger()}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {busy ? "Working…" : "Enable auto-sync now"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
