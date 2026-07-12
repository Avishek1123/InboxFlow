"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GmailTriggerFilters } from "@/features/gmail/components/gmail-trigger-filters";
import { GmailIcon } from "@/components/icons/gmail-icon";
import {
  inboxflowApiEnableUrl,
  INBOXFLOW_GCP_PROJECT_NUMBER,
} from "@/lib/gmail/inboxflow-gcp";
import { gmailClient } from "@/services/gmail-client";
import type { GmailAccountSummary } from "@/types/gmail";
import { cn } from "@/lib/utils";

export function GmailIntegrationPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [account, setAccount] = useState<GmailAccountSummary | null>(null);
  const [configured, setConfigured] = useState({
    google: false,
    encryption: false,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [legacyOAuth, setLegacyOAuth] = useState<{
    mismatch: boolean;
    project: string | null;
  }>({ mismatch: false, project: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gmailClient.getStatus();
      setAccount(res.account);
      setConfigured(res.configured);
      setLegacyOAuth({
        mismatch: Boolean(res.oauthProjectMismatch),
        project: res.legacyOAuthProject,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setMessage(
        "Gmail connected. Star or receive mail matching your triggers, then Sync now (or wait for background sync). Linked sheets update after each Gmail sync and on the sheet timer."
      );
      router.replace("/integrations/gmail");
      load();
    }
    const err = searchParams.get("error");
    if (err) {
      setError(`Connection failed: ${err}`);
      router.replace("/integrations/gmail");
    }
  }, [searchParams, router, load]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await gmailClient.sync();
      const { stats, newMessageIds, pipelineRan } = res;
      const pipelineNote = pipelineRan
        ? " Linked tables were extracted and Google Sheets were updated."
        : "";
      setMessage(
        `Sync complete: ${stats.messagesCreated} new message(s), ${stats.messagesSkipped} skipped. ${newMessageIds.length} trigger(s) fired.${pipelineNote}`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleReconnectInboxflow() {
    if (
      !confirm(
        "This will disconnect Gmail and open Google sign-in again using the InboxFlow app. Continue?"
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      if (account?.status === "ACTIVE") {
        await gmailClient.disconnect();
      }
      window.location.href = gmailClient.reconnectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reconnect failed");
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Gmail? Automations will stop receiving new mail.")) {
      return;
    }
    try {
      await gmailClient.disconnect();
      setAccount(null);
      setMessage("Gmail disconnected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    }
  }

  async function handleClearSyncedData() {
    if (
      !confirm(
        "Delete all synced Gmail messages from your inbox? Extraction rows linked to those emails will also be removed. You can sync again later."
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const { deletedMessages } = await gmailClient.clearSyncedData();
      setMessage(
        deletedMessages > 0
          ? `Removed ${deletedMessages} synced message(s) from your inbox.`
          : "No synced messages to remove."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading Gmail status…</p>;
  }

  const canConnect = configured.google && configured.encryption;
  const isConnected =
    account?.status === "ACTIVE" || account?.status === "TOKEN_EXPIRED";
  const isTokenExpired = account?.status === "TOKEN_EXPIRED";

  return (
    <div className="space-y-6">
      {!configured.google && (
        <Notice variant="warning">
          Add <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code> to{" "}
          <code className="rounded bg-muted px-1">.env</code>. Create credentials in{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Google Cloud Console
          </a>
          . Enable Gmail API and add redirect URI:{" "}
          <code className="block mt-1 rounded bg-muted px-2 py-1 text-xs">
            http://localhost:3000/api/v1/integrations/gmail/callback
          </code>
        </Notice>
      )}

      {!configured.encryption && (
        <Notice variant="warning">
          Set <code className="rounded bg-muted px-1">TOKEN_ENCRYPTION_KEY</code> in{" "}
          <code className="rounded bg-muted px-1">.env</code> (32-byte base64) to store
          OAuth tokens securely.
        </Notice>
      )}

      {(legacyOAuth.mismatch || isTokenExpired) && (
        <Notice variant="error">
          <strong>Gmail must be re-authorized for InboxFlow.</strong>{" "}
          {isTokenExpired && !legacyOAuth.mismatch
            ? (account?.syncError ??
              "Your Gmail refresh token was revoked or is no longer valid.")
            : (
              <>
                Your saved token is still from Google Cloud project{" "}
                <strong>{legacyOAuth.project ?? "1012921681881"}</strong>, not InboxFlow (
                505199243507).
              </>
            )}
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Remove InboxFlow
              </a>{" "}
              (and any older InboxFlow entry) from Google Account permissions.
            </li>
            <li>Click <strong>Reconnect with InboxFlow</strong> below (or Disconnect, then Connect).</li>
            <li>On the Google screen, pick your account and approve all requested permissions.</li>
          </ol>
          <button
            type="button"
            onClick={handleReconnectInboxflow}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Reconnect with InboxFlow
          </button>
        </Notice>
      )}

      <div className="rounded-2xl border border-border bg-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
              <GmailIcon size={28} />
            </span>
            <div>
              <h2 className="font-semibold">Gmail account</h2>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? account?.accountEmail
                  : "Not connected — connect to sync inbox & power automations"}
              </p>
            </div>
          </div>
          <StatusPill
            label={isConnected ? "Connected" : account?.status ?? "Disconnected"}
            ok={isConnected}
          />
        </div>

        {isConnected && account && (
          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <Meta label="Sync status" value={account.syncStatus} />
            <Meta
              label="Last synced"
              value={
                account.lastSyncedAt
                  ? new Date(account.lastSyncedAt).toLocaleString()
                  : "Never"
              }
            />
            <Meta label="Sync error" value={account.syncError ?? "—"} />
          </dl>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {!isConnected ? (
            <a
              href={canConnect ? gmailClient.connectUrl : undefined}
              className={cn(
                "rounded-lg px-4 py-2.5 text-sm font-medium",
                canConnect
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "cursor-not-allowed bg-muted text-muted-foreground"
              )}
              aria-disabled={!canConnect}
              onClick={(e) => {
                if (!canConnect) e.preventDefault();
              }}
            >
              Connect Gmail
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing || isTokenExpired}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync now"}
              </button>
              <button
                type="button"
                onClick={handleClearSyncedData}
                className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
              >
                Delete synced emails
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
              >
                Disconnect Gmail
              </button>
            </>
          )}
          <a
            href="/inbox"
            className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted"
          >
            View inbox
          </a>
          <a
            href="/automations"
            className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted"
          >
            Automations
          </a>
        </div>
      </div>

      {isConnected && account && (
        <GmailTriggerFilters
          initial={account.triggerFilters}
          onSaved={(settings) =>
            setAccount((prev) =>
              prev ? { ...prev, triggerFilters: settings } : prev
            )
          }
        />
      )}

      <section className="rounded-2xl border border-border bg-muted/30 p-6">
        <h3 className="text-sm font-semibold">Required Google Cloud APIs (InboxFlow)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Project number <code>{INBOXFLOW_GCP_PROJECT_NUMBER}</code> — enable each API,
          wait 2–5 minutes, then <strong>Sync now</strong>.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <a
              href={inboxflowApiEnableUrl("gmail.googleapis.com")}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              Gmail API
            </a>{" "}
            — required for sync and starred mail
          </li>
          <li>
            <a
              href={inboxflowApiEnableUrl("sheets.googleapis.com")}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              Google Sheets API
            </a>
          </li>
          <li>
            <a
              href={inboxflowApiEnableUrl("script.googleapis.com")}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              Apps Script API
            </a>
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold">How Gmail automations work</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Connect Gmail above (OAuth).</li>
          <li>
            Set <strong className="text-foreground">Message triggers</strong> — enable{" "}
            <strong className="text-foreground">Starred</strong> to sync when you star mail
            in Gmail.
          </li>
          <li>
            After you star mail in Gmail, click <strong className="text-foreground">Sync now</strong>{" "}
            (or wait for background sync every few minutes) so InboxFlow sees the label change.
          </li>
          <li>
            Linked <strong className="text-foreground">Google Sheets</strong> pull your
            extraction table after each Gmail sync and also on the sheet&apos;s{" "}
            <strong className="text-foreground">Enable auto-sync</strong> timer (~1 min).
          </li>
          <li>
            Matching messages fire workflows with the{" "}
            <strong className="text-foreground">New Gmail Email</strong> trigger.
          </li>
          <li>
            Use <strong className="text-foreground">Send Email</strong> actions to reply
            via your connected account.
          </li>
        </ol>
      </section>

      {message && (
        <Notice variant="success">{message}</Notice>
      )}
      {error && <Notice variant="error">{error}</Notice>}
    </div>
  );
}

function Notice({
  variant,
  children,
}: {
  variant: "warning" | "success" | "error";
  children: React.ReactNode;
}) {
  const styles = {
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    error:
      "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
  };
  return (
    <p className={cn("rounded-lg border p-4 text-sm", styles[variant])}>
      {children}
    </p>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        ok
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
