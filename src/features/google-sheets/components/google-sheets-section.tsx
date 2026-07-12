"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  APPS_SCRIPT_USER_SETTINGS_URL,
  INBOXFLOW_GCP_PROJECT_NUMBER,
  INBOXFLOW_GCP_PROJECT_ID,
  inboxflowApiEnableUrl,
  inboxflowAppsScriptProjectSettingsUrl,
  inboxflowCredentialsUrl,
} from "@/lib/gmail/inboxflow-gcp";
import { gmailClient } from "@/services/gmail-client";
import { extractionTableClient } from "@/services/extraction-table-client";
import { sheetExportClient } from "@/services/sheet-export-client";
import type { ExtractionTableRecord } from "@/types/extraction-table";
import type { SheetExportRecord } from "@/types/sheet-export";
import { SheetPermissionModal } from "@/features/google-sheets/components/sheet-permission-modal";
import { SheetGenerationLoader } from "@/features/google-sheets/components/sheet-generation-loader";
import {
  ColumnHeadersEditor,
  DEFAULT_COLUMN_HEADER_DRAFTS,
  draftsFromTableColumns,
  draftsToColumnPayload,
  type ColumnHeaderDraft,
} from "@/features/extraction-tables/components/column-headers-editor";
import type { ExtractionColumn } from "@/types/extraction-table";

export function GoogleSheetsSection() {
  const [tables, setTables] = useState<ExtractionTableRecord[]>([]);
  const [exports, setExports] = useState<SheetExportRecord[]>([]);
  const [tableId, setTableId] = useState("");
  const [sheetTitle, setSheetTitle] = useState("InboxFlow Export");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [installingTriggerId, setInstallingTriggerId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [needsGmailReconnect, setNeedsGmailReconnect] = useState(false);
  const [oauthProjectMismatch, setOauthProjectMismatch] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [devPublicUrl, setDevPublicUrl] = useState<string | null>(null);
  const [tunnelReachable, setTunnelReachable] = useState<boolean | null>(null);
  const [tunnelHealthError, setTunnelHealthError] = useState<string | null>(
    null
  );
  const [staleConfiguredUrl, setStaleConfiguredUrl] = useState(false);
  const [refreshingTunnel, setRefreshingTunnel] = useState(false);
  const [permissionModal, setPermissionModal] = useState<{
    exportId: string;
    reconnectUrl: string;
  } | null>(null);
  const [gcpLinkHelp, setGcpLinkHelp] = useState<{
    scriptId: string;
    spreadsheetUrl: string | null;
  } | null>(null);
  const [exportStatus, setExportStatus] = useState<
    Record<
      string,
      {
        lastFetchedAt: string | null;
        autoSyncOn: boolean;
        triggerCount: number;
        usesLocaltunnel: boolean;
        triggerCheckError?: string;
      }
    >
  >({});
  const [repushingId, setRepushingId] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [triggerMinutes, setTriggerMinutes] = useState(1);
  const [genLoaderOpen, setGenLoaderOpen] = useState(false);
  const [genLoaderDone, setGenLoaderDone] = useState(false);
  const [genLoaderError, setGenLoaderError] = useState<string | null>(null);
  const [genLoaderTitle, setGenLoaderTitle] = useState(
    "Generating your Google Sheet"
  );
  const [columnDrafts, setColumnDrafts] = useState<ColumnHeaderDraft[]>(
    DEFAULT_COLUMN_HEADER_DRAFTS
  );
  const [createNewTable, setCreateNewTable] = useState(false);

  function formatLastSync(iso: string | null | undefined): string {
    if (!iso) return "Never synced";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1) return "Synced just now";
    if (mins < 60) return `Synced ${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `Synced ${hours}h ago`;
    return `Synced ${new Date(iso).toLocaleDateString()}`;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ items: tableItems }, { items: exportItems }, gmailStatus] =
        await Promise.all([
          extractionTableClient.list(),
          sheetExportClient.list(),
          gmailClient.getStatus(),
        ]);
      setGmailConnected(Boolean(gmailStatus.account));
      setNeedsGmailReconnect(
        Boolean(gmailStatus.account) && !gmailStatus.sheetsScopesGranted
      );
      setOauthProjectMismatch(Boolean(gmailStatus.oauthProjectMismatch));
      setTables(tableItems);
      setExports(exportItems);
      const statusMap: typeof exportStatus = {};
      await Promise.all(
        exportItems.map(async (exp) => {
          try {
            const s = await sheetExportClient.status(exp.id);
            statusMap[exp.id] = {
              lastFetchedAt: s.lastFetchedAt,
              autoSyncOn: s.autoSyncOn,
              triggerCount: s.triggerCount,
              usesLocaltunnel: s.usesLocaltunnel,
              triggerCheckError: s.triggerCheckError,
            };
          } catch {
            /* status optional */
          }
        })
      );
      setExportStatus(statusMap);
      setTableId((prev) => {
        if (prev) return prev;
        return tableItems[0]?.id ?? "";
      });

      try {
        const tunnelRes = await fetch("/api/v1/dev/tunnel");
        if (tunnelRes.ok) {
          const json = (await tunnelRes.json()) as {
            data?: {
              publicUrl?: string;
              isPublic?: boolean;
              reachable?: boolean;
              healthError?: string;
              staleConfiguredUrl?: boolean;
            };
          };
          if (json.data?.isPublic && json.data.publicUrl) {
            setDevPublicUrl(json.data.publicUrl);
            setTunnelReachable(json.data.reachable ?? null);
            setTunnelHealthError(json.data.healthError ?? null);
            setStaleConfiguredUrl(Boolean(json.data.staleConfiguredUrl));
          } else {
            setDevPublicUrl(null);
            setTunnelReachable(null);
            setTunnelHealthError(null);
            setStaleConfiguredUrl(false);
          }
        }
      } catch {
        setDevPublicUrl(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = tables.find((x) => x.id === tableId);
    if (t) setSheetTitle(`${t.name} — InboxFlow`);
  }, [tableId, tables]);

  useEffect(() => {
    if (devPublicUrl && !apiBaseUrl) {
      setApiBaseUrl(devPublicUrl);
    }
  }, [devPublicUrl, apiBaseUrl]);

  useEffect(() => {
    if (createNewTable) return;
    const t = tables.find((x) => x.id === tableId);
    if (t) {
      setColumnDrafts(draftsFromTableColumns(t.columns));
    }
  }, [tableId, tables, createNewTable]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const cols = draftsToColumnPayload(columnDrafts);
    if (cols.length === 0) {
      setError("Add at least one column header.");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);
    setGenLoaderTitle("Generating your Google Sheet");
    setGenLoaderDone(false);
    setGenLoaderError(null);
    setGenLoaderOpen(true);
    try {
      let targetTableId = tableId;
      const existingTable = tables.find((t) => t.id === tableId);

      if (createNewTable || !targetTableId || availableTables.length === 0) {
        const tableName =
          sheetTitle.replace(/\s*—\s*InboxFlow$/i, "").trim() ||
          "Sheet export";
        const { item } = await extractionTableClient.create({
          name: tableName,
          columns: cols,
        });
        targetTableId = item.id;
      } else if (existingTable) {
        await extractionTableClient.update(targetTableId, {
          columns: draftsToColumnPayload(
            columnDrafts,
            existingTable.columns as ExtractionColumn[]
          ),
        });
      }

      const { item } = await sheetExportClient.create({
        extractionTableId: targetTableId,
        label: label.trim() || undefined,
        sheetTitle: sheetTitle.trim() || undefined,
        apiBaseUrl: apiBaseUrl.trim() || undefined,
        triggerMinutes,
      });

      setGenLoaderDone(true);

      if (item.needsGooglePermissions && item.reconnectUrl) {
        setPermissionModal({
          exportId: item.id,
          reconnectUrl: item.reconnectUrl,
        });
        setSuccess(
          item.syncNote ??
            "Sheet created. Grant Google permissions in the popup to finish the timer."
        );
      } else if (item.triggerInstalled) {
        setSuccess(
          item.syncNote ??
            "Your Google Sheet is ready with the automatic timer installed."
        );
      } else {
        setSuccess(item.syncNote ?? "Your Google Sheet was created.");
      }
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create sheet";
      setGenLoaderError(msg);
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  function closeGenLoader() {
    setGenLoaderOpen(false);
    setGenLoaderDone(false);
    setGenLoaderError(null);
  }

  async function handleInstallTrigger(exportId: string) {
    setInstallingTriggerId(exportId);
    setError(null);
    try {
      const res = await sheetExportClient.installTrigger(exportId, {
        repairOnly: false,
      });
      if (res.triggerInstalled) {
        setGcpLinkHelp(null);
        setSuccess(res.message);
        await load();
        return;
      }
      if (res.reason === "gcp_project") {
        setGcpLinkHelp({
          scriptId: res.appsScriptId,
          spreadsheetUrl: res.spreadsheetUrl,
        });
        setSuccess(null);
        await load();
        return;
      }
      if (
        res.reason === "authorization" ||
        res.reason === "sheet_menu" ||
        res.reason === "open_sheet"
      ) {
        setSuccess(res.message);
        await load();
        return;
      }
      setError(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not install sheet trigger");
    } finally {
      setInstallingTriggerId(null);
    }
  }

  function buildReconnectUrl(exportId: string) {
    const url = new URL("/api/v1/integrations/gmail/connect", window.location.origin);
    url.searchParams.set("reconnect", "1");
    url.searchParams.set("popup", "1");
    url.searchParams.set("sheetExportId", exportId);
    url.searchParams.set("openerOrigin", window.location.origin);
    return url.toString();
  }

  function openEnableAutoSync(exportId: string) {
    setPermissionModal({
      exportId,
      reconnectUrl: buildReconnectUrl(exportId),
    });
  }

  async function handleSync(exportId: string) {
    setSyncingId(exportId);
    setError(null);
    try {
      // If auto-sync is off (often because script still points at localhost), open the
      // permission modal first so we can push a public URL + install the timer.
      if (!exportStatus[exportId]?.autoSyncOn) {
        openEnableAutoSync(exportId);
      }

      const result = await sheetExportClient.sync(exportId);
      const sheetName =
        exports.find((e) => e.id === exportId)?.sheetTitle ?? "InboxFlow";
      if (result.rowCount === 0) {
        setSuccess(
          "Sync finished but the table has 0 rows. Enable Starred under Gmail triggers, click Sync Gmail, then Sync now again."
        );
      } else if (result.extraction.succeeded > 0) {
        setSuccess(
          `Extracted ${result.extraction.succeeded} new message(s) and synced ${result.rowCount} rows to "${sheetName}".`
        );
      } else {
        setSuccess(
          `Synced ${result.rowCount} rows to "${sheetName}". No new messages to extract — run Sync Gmail if starred mail is missing.`
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  async function handleRepushScript(exportId: string) {
    setRepushingId(exportId);
    setError(null);
    setGenLoaderTitle("Updating Apps Script on your sheet");
    setGenLoaderDone(false);
    setGenLoaderError(null);
    setGenLoaderOpen(true);
    try {
      const res = await sheetExportClient.repushScript(exportId, {
        apiBaseUrl: apiBaseUrl.trim() || undefined,
        triggerMinutes,
      });
      setGenLoaderDone(true);
      setSuccess(res.message);
      await load();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not update sheet script";
      setGenLoaderError(msg);
      setError(msg);
    } finally {
      setRepushingId(null);
    }
  }

  async function handleDelete(exportId: string) {
    if (!confirm("Remove this Google Sheet link from InboxFlow?")) return;
    await sheetExportClient.delete(exportId);
    setSuccess(null);
    await load();
  }

  const linkedTableIds = new Set(exports.map((e) => e.extractionTableId));
  const availableTables = tables.filter((t) => !linkedTableIds.has(t.id));

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <SheetGenerationLoader
        open={genLoaderOpen}
        title={genLoaderTitle}
        done={genLoaderDone}
        error={genLoaderError}
        onClose={closeGenLoader}
      />
      {tunnelReachable === false && devPublicUrl && (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          <p className="font-semibold">Sheet auto-sync cannot reach your dev server</p>
          <p className="mt-2">
            The sheet timer calls{" "}
            <code className="break-all text-xs">{devPublicUrl}</code>, but that URL is
            not responding
            {tunnelHealthError?.includes("503") ? " (503)" : ""}.
            {staleConfiguredUrl && (
              <>
                {" "}
                Your <code>.env</code> still has an old ngrok URL — set{" "}
                <code>NEXT_PUBLIC_APP_URL=http://localhost:3000</code> and restart.
              </>
            )}
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs">
            <li>
              Confirm <code>NGROK_AUTHTOKEN</code> is in <code>.env</code> (
              <a
                href="https://dashboard.ngrok.com/get-started/your-authtoken"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                ngrok dashboard
              </a>
              )
            </li>
            <li>
              Restart <code>npm run dev</code> and check the terminal for{" "}
              <code>[dev-tunnel] Public URL</code>
            </li>
            <li>
              Click <strong>Update script</strong> so the sheet uses the new URL
            </li>
          </ol>
          {tunnelHealthError && (
            <p className="mt-2 text-xs opacity-90">{tunnelHealthError}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={refreshingTunnel}
              onClick={async () => {
                setRefreshingTunnel(true);
                try {
                  const res = await fetch("/api/v1/dev/tunnel", { method: "POST" });
                  const json = (await res.json()) as {
                    data?: {
                      publicUrl?: string;
                      reachable?: boolean;
                      healthError?: string;
                    };
                    error?: { message?: string };
                  };
                  if (json.error?.message) {
                    setTunnelHealthError(json.error.message);
                    return;
                  }
                  if (json.data?.publicUrl) {
                    setDevPublicUrl(json.data.publicUrl);
                    setApiBaseUrl(json.data.publicUrl);
                    setTunnelReachable(json.data.reachable ?? null);
                    setTunnelHealthError(json.data.healthError ?? null);
                    if (json.data.reachable) {
                      const first = exports[0];
                      if (first) {
                        setSuccess(
                          "Tunnel is up. Updating Apps Script on your sheet…"
                        );
                        await handleRepushScript(first.id);
                        setSuccess(
                          `Tunnel OK (${json.data.publicUrl}). Sheet script updated — Sync from the sheet should work now.`
                        );
                      } else {
                        setSuccess(
                          "Tunnel is up. Create or Update script on a sheet export below."
                        );
                      }
                    }
                  }
                } catch {
                  setTunnelHealthError("Could not restart tunnel");
                } finally {
                  setRefreshingTunnel(false);
                }
              }}
              className="rounded-lg border border-red-400 px-3 py-1.5 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900"
            >
              {refreshingTunnel ? "Restarting…" : "Restart tunnel + Update script"}
            </button>
          </div>
          <p className="mt-3 text-xs">
            <strong>Sync now</strong> on this page still works — it does not use the
            tunnel.
          </p>
        </div>
      )}
      {tunnelReachable === true && devPublicUrl && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Dev tunnel active: <code className="break-all">{devPublicUrl}</code>
          {staleConfiguredUrl && (
            <span className="block mt-1">
              Update <code>.env</code>: set <code>NEXT_PUBLIC_APP_URL=http://localhost:3000</code>{" "}
              (remove the old ngrok URL), then click <strong>Update script</strong>.
            </span>
          )}
        </p>
      )}
      {gcpLinkHelp && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Link this sheet&apos;s script to InboxFlow GCP</p>
          <p className="mt-1 text-xs opacity-90">
            Google error: the Apps Script project must use the same Cloud project as your
            InboxFlow login ({INBOXFLOW_GCP_PROJECT_NUMBER}).
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>
              <a
                href={inboxflowAppsScriptProjectSettingsUrl(gcpLinkHelp.scriptId)}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                Open Apps Script project settings
              </a>
            </li>
            <li>
              Under <strong>Google Cloud Platform (GCP) Project</strong> → Change project →
              enter <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">{INBOXFLOW_GCP_PROJECT_NUMBER}</code> →
              Set project.
            </li>
            <li>Confirm it shows <strong>inboxflow-497809</strong> (not a random default project).</li>
            <li>Wait 1 minute, then click <strong>Install sheet trigger</strong> below again.</li>
          </ol>
          <p className="mt-3 text-xs">
            Or skip GCP:{" "}
            {gcpLinkHelp.spreadsheetUrl ? (
              <a
                href={gcpLinkHelp.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                open the sheet
              </a>
            ) : (
              "open the sheet"
            )}{" "}
            → menu <strong>InboxFlow</strong> → <strong>Enable auto-sync</strong>.
          </p>
          <button
            type="button"
            onClick={() => setGcpLinkHelp(null)}
            className="mt-3 text-xs underline opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}
      {permissionModal && (
        <SheetPermissionModal
          exportId={permissionModal.exportId}
          reconnectUrl={permissionModal.reconnectUrl}
          onDone={(message) => {
            setPermissionModal(null);
            setSuccess(message);
            void load();
          }}
          onCancel={() => setPermissionModal(null)}
        />
      )}
      {!gmailConnected && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <Link href="/integrations/gmail" className="font-semibold underline">
            Connect Gmail
          </Link>{" "}
          first (same Google account you want for Sheets).
        </p>
      )}
      {oauthProjectMismatch && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
          Gmail is still using the <strong>old Google Cloud app</strong>, not InboxFlow.
          Open{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            Google Account permissions
          </a>
          , remove InboxFlow, then{" "}
          <a
            href="/api/v1/integrations/gmail/connect?reconnect=1"
            className="font-semibold underline"
          >
            Reconnect Gmail with InboxFlow
          </a>
          .
        </p>
      )}
      {needsGmailReconnect && !oauthProjectMismatch && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Google Sheets permissions are missing.{" "}
          <a
            href="/api/v1/integrations/gmail/connect"
            className="font-semibold underline"
          >
            Reconnect Gmail
          </a>{" "}
          using OAuth from the{" "}
          <a
            href={inboxflowCredentialsUrl()}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            InboxFlow
          </a>{" "}
          project, then try again.
        </p>
      )}
      <p className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        InboxFlow GCP: enable{" "}
        <a
          href={inboxflowApiEnableUrl("sheets.googleapis.com")}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Sheets API
        </a>{" "}
        and{" "}
        <a
          href={inboxflowApiEnableUrl("script.googleapis.com")}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Apps Script API
        </a>{" "}
        on project <code className="text-foreground">inboxflow-497809</code>.
        {" "}
        Enable the Apps Script API for your Google account{" "}
        <a
          href={APPS_SCRIPT_USER_SETTINGS_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          here
        </a>
        .
        {" "}
        <strong>Connect Gmail once</strong> (includes Sheets + Apps Script). In local dev, a
        temporary public URL is started automatically for sheet triggers (ngrok or localtunnel).
        {devPublicUrl ? (
          <>
            {" "}
            Active URL:{" "}
            <code className="text-foreground break-all">{devPublicUrl}</code>
            {devPublicUrl.includes("loca.lt") && (
              <>
                {" "}
                <span className="text-amber-800 dark:text-amber-200">
                  (localtunnel often blocks sheet auto-sync — add NGROK_AUTHTOKEN for reliable
                  timers.)
                </span>
              </>
            )}
          </>
        ) : (
          <>
            {" "}
            Add <code className="text-foreground">NGROK_AUTHTOKEN</code> to{" "}
            <code className="text-foreground">.env</code> (free) and restart{" "}
            <code className="text-foreground">npm run dev</code>.
          </>
        )}
      </p>
      <section className="rounded-2xl border border-border bg-background p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Create a Google Sheet from your dashboard table</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates a <strong>ready-to-view</strong> Google Sheet with your table data.
          Ongoing updates use the same{" "}
          <Link href="/integrations/gmail" className="font-medium underline">
            Gmail
          </Link>{" "}
          connection you already approved — no second login in the sheet.
        </p>
        <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Starred email → sheet:</strong> the
          Apps Script and Sync now only write{" "}
          <strong className="text-foreground">starred Gmail</strong> rows (plus
          WhatsApp). Enable <strong className="text-foreground">Starred</strong>{" "}
          under Gmail triggers, star the message, then{" "}
          <Link href="/integrations/gmail" className="underline">
            Sync Gmail
          </Link>
          . Click <strong>Update script</strong> if your sheet was created before
          this change.
        </p>

        {tables.length === 0 || availableTables.length > 0 ? (
          <form onSubmit={handleCreate} className="mt-6 max-w-2xl space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <p className="font-semibold">InboxFlow Google Cloud only</p>
              <p className="mt-1 text-xs opacity-90">
                OAuth, Sheets, and Apps Script use project{" "}
                <code>{INBOXFLOW_GCP_PROJECT_ID}</code> (number{" "}
                {INBOXFLOW_GCP_PROJECT_NUMBER}). Reconnect Gmail if you use another
                project.
              </p>
            </div>
            {availableTables.length > 0 ? (
              <div>
                <label className="block text-sm font-medium">Data source</label>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!createNewTable}
                      onChange={() => setCreateNewTable(false)}
                    />
                    Use existing table
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={createNewTable}
                      onChange={() => {
                        setCreateNewTable(true);
                        setColumnDrafts([...DEFAULT_COLUMN_HEADER_DRAFTS]);
                      }}
                    />
                    Create new table from headers below
                  </label>
                </div>
                {!createNewTable && (
                  <select
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                    required={!createNewTable}
                  >
                    {availableTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.rowCount ?? 0} rows)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                No dashboard table yet — headers below will create a new table
                automatically.
              </p>
            )}
            <div>
              <label className="block text-sm font-medium">
                Sheet column headers
              </label>
              <div className="mt-2">
                <ColumnHeadersEditor
                  drafts={columnDrafts}
                  onChange={setColumnDrafts}
                  disabled={creating}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium">Spreadsheet name</label>
              <input
                value={sheetTitle}
                onChange={(e) => setSheetTitle(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Public API URL (embedded in Apps Script)
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                InboxFlow calls this URL to sync rows. Dev: use ngrok URL from
                terminal. Production: your deployed app URL.
              </p>
              <input
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="https://your-app.ngrok-free.dev"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Auto-sync interval (minutes)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={triggerMinutes}
                onChange={(e) =>
                  setTriggerMinutes(
                    Math.min(60, Math.max(1, Number(e.target.value) || 1))
                  )
                }
                className="mt-1.5 w-32 rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Written into the generated script timer (1–60 min).
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">
                Label <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                placeholder="My sales export"
              />
            </div>
            <button
              type="submit"
              disabled={
                creating ||
                (!createNewTable &&
                  availableTables.length === 0 &&
                  tables.length > 0) ||
                (!createNewTable && !tableId && tables.length > 0) ||
                !gmailConnected ||
                needsGmailReconnect ||
                oauthProjectMismatch
              }
              className="rounded-lg bg-[#0F9D58] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Generating…" : "Create Google Sheet & script"}
            </button>
          </form>
        ) : availableTables.length === 0 && exports.length > 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Each table can have one sheet. Remove an export below to create another.
          </p>
        ) : null}
      </section>

      {exports.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Your Google Sheets</h3>
          {exports.map((exp) => (
            <div
              key={exp.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{exp.extractionTableName}</p>
                <p className="text-xs text-muted-foreground">
                  Sheet tab: <strong>{exp.sheetTitle}</strong>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {exportStatus[exp.id]?.autoSyncOn ? (
                    <span className="text-emerald-700 dark:text-emerald-300">
                      Auto-sync: on ({exportStatus[exp.id]?.triggerCount ?? 0}{" "}
                      timer)
                    </span>
                  ) : exportStatus[exp.id]?.triggerCheckError ===
                    "gcp_link_required" ? (
                    <span className="text-amber-800 dark:text-amber-200">
                      Auto-sync: off (link GCP in script settings)
                    </span>
                  ) : (
                    <span>Auto-sync: off — click Enable auto-sync</span>
                  )}
                  {" · "}
                  {formatLastSync(
                    exportStatus[exp.id]?.lastFetchedAt ?? exp.lastFetchedAt
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {exp.spreadsheetUrl && (
                  <a
                    href={exp.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0F9D58] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Open Google Sheet
                  </a>
                )}
                {!exportStatus[exp.id]?.autoSyncOn && (
                  <button
                    type="button"
                    onClick={() => openEnableAutoSync(exp.id)}
                    disabled={!gmailConnected || needsGmailReconnect}
                    className="rounded-lg bg-[#0F9D58] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Enable auto-sync
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleInstallTrigger(exp.id)}
                  disabled={
                    installingTriggerId === exp.id ||
                    !gmailConnected ||
                    needsGmailReconnect
                  }
                  className="rounded-lg border border-[#0F9D58]/40 px-4 py-2.5 text-sm font-medium text-[#0F9D58] hover:bg-[#0F9D58]/10 disabled:opacity-50"
                >
                  {installingTriggerId === exp.id
                    ? "Installing…"
                    : "Retry timer install"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSync(exp.id)}
                  disabled={syncingId === exp.id || !gmailConnected}
                  className="rounded-lg bg-[#0F9D58]/15 px-4 py-2.5 text-sm font-semibold text-[#0F9D58] hover:bg-[#0F9D58]/25 disabled:opacity-50"
                  title="Sync Gmail, extract new rows, and write to the sheet"
                >
                  {syncingId === exp.id ? "Syncing…" : "Sync now"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRepushScript(exp.id)}
                  disabled={
                    repushingId === exp.id || !gmailConnected || needsGmailReconnect
                  }
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                  title="Update Apps Script on the sheet + sync data (use after Enable auto-sync)"
                >
                  {repushingId === exp.id ? "Updating…" : "Update script"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(exp.id)}
                  className="text-sm text-muted-foreground underline hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
