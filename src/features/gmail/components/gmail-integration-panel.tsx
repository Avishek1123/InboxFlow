"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GmailTriggerFilters } from "@/features/gmail/components/gmail-trigger-filters";
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gmailClient.getStatus();
      setAccount(res.account);
      setConfigured(res.configured);
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
      setMessage("Gmail connected successfully. Run a sync to import messages.");
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
      const { stats, newMessageIds } = res;
      setMessage(
        `Sync complete: ${stats.messagesCreated} new message(s), ${stats.messagesSkipped} skipped. ${newMessageIds.length} automation trigger(s) fired.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
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
  const isConnected = account?.status === "ACTIVE";

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

      <div className="rounded-2xl border border-border bg-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-lg font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
              G
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
                disabled={syncing}
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

      <section className="rounded-2xl border border-border p-6">
        <h3 className="text-sm font-semibold">How Gmail automations work</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Connect Gmail above (OAuth).</li>
          <li>
            Set <strong className="text-foreground">Message triggers</strong> (starred,
            important, inbox, etc.).
          </li>
          <li>
            Click <strong className="text-foreground">Sync now</strong> — matching
            messages are imported.
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
