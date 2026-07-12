"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GmailIcon } from "@/components/icons/gmail-icon";
import {
  DEFAULT_COLUMN_HEADER_DRAFTS,
  draftsToColumnPayload,
} from "@/features/extraction-tables/components/column-headers-editor";
import type { IntegrationStatusState } from "@/features/automations/hooks/use-integration-status";
import { extractionTableClient } from "@/services/extraction-table-client";
import { sheetExportClient } from "@/services/sheet-export-client";
import type { SheetExportRecord } from "@/types/sheet-export";
import type { WorkflowGraph } from "@/types/automation";

export function graphNeedsSheetLink(graph: WorkflowGraph): boolean {
  return graph.nodes.some((n) =>
    ["SHEETS_UPSERT", "EXTRACT_TO_TABLE"].includes(n.data.kind)
  );
}

export function graphNeedsGmail(graph: WorkflowGraph): boolean {
  return graph.nodes.some((n) => {
    const kind = n.data.kind;
    if (
      kind === "NEW_GMAIL_EMAIL" ||
      kind === "SEND_EMAIL" ||
      kind === "SHEETS_UPSERT" ||
      kind === "EXTRACT_TO_TABLE"
    ) {
      return true;
    }
    return false;
  });
}

type Props = {
  graph: WorkflowGraph;
  workflowName: string;
  workflowStatus: string;
  integrationStatus: IntegrationStatusState;
  onConnectGmail: () => void;
  onRefreshIntegrations: () => Promise<void>;
  /** Called after a sheet is linked/created so nodes can store exportId/tableId */
  onSheetReady: (sheet: SheetExportRecord) => void;
  /** Called when the linked sheet is removed */
  onSheetCleared: () => void;
  selectedExportId?: string;
};

export function AutomationSetupPanel({
  graph,
  workflowName,
  workflowStatus,
  integrationStatus,
  onConnectGmail,
  onRefreshIntegrations,
  onSheetReady,
  onSheetCleared,
  selectedExportId,
}: Props) {
  const needsGmail = graphNeedsGmail(graph);
  const needsSheet = graphNeedsSheetLink(graph);
  const [exports, setExports] = useState<SheetExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetTitle, setSheetTitle] = useState(
    () => `${workflowName.replace(/\s+/g, " ").trim() || "Automation"} export`
  );

  const gmailOk =
    integrationStatus.gmail.connected && !integrationStatus.gmail.needsReconnect;

  const loadExports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await sheetExportClient.list();
      setExports(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sheets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!needsSheet) {
      setLoading(false);
      return;
    }
    void loadExports();
  }, [needsSheet, loadExports]);

  const didAutoLink = useRef(false);
  useEffect(() => {
    if (!needsSheet || exports.length === 0 || didAutoLink.current) return;
    const match = selectedExportId
      ? exports.find((i) => i.id === selectedExportId)
      : exports[0];
    if (!match) return;
    didAutoLink.current = true;
    onSheetReady(match);
  }, [exports, needsSheet, selectedExportId, onSheetReady]);

  useEffect(() => {
    setSheetTitle(
      `${workflowName.replace(/\s+/g, " ").trim() || "Automation"} export`
    );
  }, [workflowName]);

  if (!needsGmail && !needsSheet) return null;

  const activeSheet =
    exports.find((e) => e.id === selectedExportId) ?? exports[0] ?? null;
  const isActive = workflowStatus === "ACTIVE";
  const setupComplete =
    (!needsGmail || gmailOk) && (!needsSheet || Boolean(activeSheet?.spreadsheetUrl));

  async function autoCreateSheet(options?: {
    forceNew?: boolean;
    tableId?: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      if (!gmailOk) {
        throw new Error("Connect Gmail with Sheets permission first");
      }

      const { items: latestExports } = await sheetExportClient.list();
      setExports(latestExports);

      let tables = (await extractionTableClient.list()).items;
      let table =
        (options?.tableId
          ? tables.find((t) => t.id === options.tableId)
          : null) ?? tables[0];
      if (!table) {
        const created = await extractionTableClient.create({
          name: `${workflowName.trim() || "Automation"} leads`,
          columns: draftsToColumnPayload(DEFAULT_COLUMN_HEADER_DRAFTS),
        });
        table = created.item;
      }

      if (!options?.forceNew) {
        const existing =
          latestExports.find((e) => e.extractionTableId === table!.id) ??
          latestExports.find((e) => Boolean(e.spreadsheetUrl)) ??
          null;
        if (existing?.spreadsheetUrl) {
          onSheetReady(existing);
          return;
        }
      }

      const { item } = await sheetExportClient.create({
        extractionTableId: table.id,
        label: sheetTitle.trim() || undefined,
        sheetTitle: sheetTitle.trim() || undefined,
      });

      if (item.needsGooglePermissions && item.reconnectUrl) {
        setError(
          "Google needs Sheets permission. Click Connect Gmail, approve access, then try Auto-create again."
        );
        onConnectGmail();
        return;
      }

      didAutoLink.current = true;
      await loadExports();
      onSheetReady(item);
      await onRefreshIntegrations();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not create sheet";
      if (!options?.forceNew && /already has a Google Sheet/i.test(message)) {
        try {
          const { items } = await sheetExportClient.list();
          setExports(items);
          const existing = items.find((x) => Boolean(x.spreadsheetUrl));
          if (existing) {
            onSheetReady(existing);
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function removeLinkedSheet() {
    if (!activeSheet) return;
    if (
      !confirm(
        "Remove this Google Sheet link from InboxFlow? The spreadsheet file in Google Drive is not deleted — only the InboxFlow link."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sheetExportClient.delete(activeSheet.id);
      didAutoLink.current = true; // prevent auto-relinking another sheet immediately
      onSheetCleared();
      await loadExports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove sheet");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateSheet() {
    if (!activeSheet) {
      await autoCreateSheet({ forceNew: true });
      return;
    }
    if (
      !confirm(
        "Remove the current sheet link and create a new Google Sheet? The old Drive file is kept; InboxFlow will use the new one."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const tableId = activeSheet.extractionTableId;
    try {
      await sheetExportClient.delete(activeSheet.id);
      didAutoLink.current = true;
      onSheetCleared();
      setExports((prev) => prev.filter((e) => e.id !== activeSheet.id));
      await autoCreateSheet({ forceNew: true, tableId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not regenerate sheet");
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        setupComplete
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-amber-500/40 bg-amber-500/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isActive && setupComplete
              ? "Connected for this workflow"
              : "Setup required before activate"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {needsGmail && needsSheet
              ? "Authorize Gmail (with Sheets access) and link or auto-create a Google Sheet."
              : needsGmail
                ? "Authorize Gmail for this workflow."
                : "Link an existing Google Sheet or auto-create one."}
          </p>
        </div>
        {isActive && activeSheet?.spreadsheetUrl && (
          <a
            href={activeSheet.spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Open Google Sheet ↗
          </a>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {needsGmail && (
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <GmailIcon size={18} />
              <p className="text-sm font-medium">Gmail authorization</p>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  gmailOk
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                }`}
              >
                {gmailOk ? "Connected" : "Needed"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Required for email triggers/sends and for creating or updating Google Sheets.
            </p>
            {!gmailOk && (
              <button
                type="button"
                onClick={onConnectGmail}
                className="mt-2 rounded-md bg-[#ea4335] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                {integrationStatus.gmail.connected
                  ? "Reconnect Gmail + Sheets"
                  : "Authorize Gmail"}
              </button>
            )}
            {gmailOk && (
              <button
                type="button"
                onClick={onConnectGmail}
                className="mt-2 text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                Reconnect if permissions expired
              </button>
            )}
          </div>
        )}

        {needsSheet && (
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-[18px] w-[18px] items-center justify-center rounded bg-emerald-600 text-[10px] font-bold text-white">
                S
              </span>
              <p className="text-sm font-medium">Google Sheet</p>
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  activeSheet?.spreadsheetUrl
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                }`}
              >
                {activeSheet?.spreadsheetUrl ? "Linked" : "Needed"}
              </span>
            </div>

            {loading ? (
              <p className="mt-2 text-[11px] text-muted-foreground">Loading sheets…</p>
            ) : exports.length > 0 ? (
              <div className="mt-2 space-y-2">
                <label className="block text-[11px]">
                  <span className="text-muted-foreground">Use linked sheet</span>
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    value={activeSheet?.id ?? ""}
                    onChange={(e) => {
                      const row = exports.find((x) => x.id === e.target.value);
                      if (row) onSheetReady(row);
                    }}
                  >
                    {exports.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.label || ex.sheetTitle} · {ex.extractionTableName}
                      </option>
                    ))}
                  </select>
                </label>
                {activeSheet?.spreadsheetUrl && (
                  <a
                    href={activeSheet.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-medium text-emerald-700 underline dark:text-emerald-300"
                  >
                    {activeSheet.spreadsheetUrl}
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                No sheet linked yet. Auto-create one for this workflow, or create it on the
                Google Sheets page.
              </p>
            )}

            <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
              <label className="block text-[11px]">
                <span className="text-muted-foreground">New sheet title</span>
                <input
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  placeholder="My automation export"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !gmailOk}
                  onClick={() => void autoCreateSheet()}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? "Working…" : "Auto-create Google Sheet"}
                </button>
                {activeSheet && (
                  <>
                    <button
                      type="button"
                      disabled={busy || !gmailOk}
                      onClick={() => void regenerateSheet()}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      Remove & regenerate
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeLinkedSheet()}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      Remove sheet
                    </button>
                  </>
                )}
                <Link
                  href="/google-sheets"
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  Open Sheets page
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}

export function isAutomationSetupReady(params: {
  graph: WorkflowGraph;
  gmailOk: boolean;
  hasSheet: boolean;
}): boolean {
  const needsGmail = graphNeedsGmail(params.graph);
  const needsSheet = graphNeedsSheetLink(params.graph);
  if (needsGmail && !params.gmailOk) return false;
  if (needsSheet && !params.hasSheet) return false;
  return true;
}
