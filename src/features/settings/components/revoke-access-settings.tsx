"use client";

import { useState } from "react";

export function RevokeAccessSettings() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revokeAll() {
    const ok = confirm(
      "Remove ALL access for this workspace?\n\nThis disconnects Gmail (and revokes Google tokens), WhatsApp, Twilio, and linked Google Sheet exports.\n\nYou will need to reconnect before automations can run again."
    );
    if (!ok) return;

    const typed = window.prompt(
      'Type REMOVE to confirm removing all access permanently from InboxFlow.'
    );
    if (typed?.trim().toUpperCase() !== "REMOVE") {
      setError("Cancelled — type REMOVE exactly to confirm.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/settings/revoke-all-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || "Failed");
      setMessage(json.data.message as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove access");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-lg rounded-2xl border border-red-200 bg-red-50/40 p-6 shadow-sm dark:border-red-900 dark:bg-red-950/30">
      <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
        Access & permissions
      </h2>
      <p className="mt-1 text-sm text-red-900/80 dark:text-red-100/80">
        Disconnect every connected account for this workspace in one step — Gmail,
        WhatsApp, Twilio, and Google Sheet links. Tokens stored in InboxFlow are
        cleared; Gmail OAuth is revoked with Google when possible.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void revokeAll()}
        className="mt-4 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
      >
        {busy ? "Removing access…" : "Remove all access"}
      </button>
      {message && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
        </p>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        For complete Google account cleanup, also remove InboxFlow at{" "}
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          myaccount.google.com/permissions
        </a>
        .
      </p>
    </section>
  );
}
