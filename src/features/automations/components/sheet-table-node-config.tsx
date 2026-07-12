"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sheetExportClient } from "@/services/sheet-export-client";
import { extractionTableClient } from "@/services/extraction-table-client";
import type { SheetExportRecord } from "@/types/sheet-export";
import type { ExtractionTableRecord } from "@/types/extraction-table";

type Props = {
  exportId?: string;
  tableId?: string;
  messageId?: string;
  onFieldChange: (key: string, value: unknown) => void;
  mode: "sheets" | "table" | "extract";
};

export function SheetTableNodeConfig({
  exportId,
  tableId,
  messageId,
  onFieldChange,
  mode,
}: Props) {
  const [exports, setExports] = useState<SheetExportRecord[]>([]);
  const [tables, setTables] = useState<ExtractionTableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      sheetExportClient.list().catch(() => ({ items: [] as SheetExportRecord[] })),
      extractionTableClient.list().catch(() => ({ items: [] as ExtractionTableRecord[] })),
    ])
      .then(([ex, tb]) => {
        if (cancelled) return;
        setExports(ex.items);
        setTables(tb.items);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load sheets");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedExport =
    exports.find((e) => e.id === exportId) ??
    exports.find((e) => e.extractionTableId === tableId) ??
    null;

  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading linked sheets…</p>;
  }

  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }

  if (mode === "sheets" && exports.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">No Google Sheet linked yet</p>
        <p>
          Use the setup bar above to authorize Gmail and auto-create a sheet, or
          create one on the Google Sheets page.
        </p>
        <Link
          href="/google-sheets"
          className="inline-flex rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          Open Google Sheets →
        </Link>
      </div>
    );
  }

  if ((mode === "table" || mode === "extract") && tables.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">No data tables yet</p>
        <p>Create a table on the Dashboard, then link it to a Google Sheet.</p>
        <Link
          href="/dashboard"
          className="inline-flex rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Open Dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mode === "sheets" && (
        <label className="block text-xs">
          <span className="font-medium text-foreground">Linked Google Sheet</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={exportId || selectedExport?.id || ""}
            onChange={(e) => {
              const id = e.target.value;
              onFieldChange("exportId", id);
              const row = exports.find((x) => x.id === id);
              if (row) onFieldChange("tableId", row.extractionTableId);
            }}
          >
            <option value="">Latest linked sheet (auto)</option>
            {exports.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.label || ex.sheetTitle} · {ex.extractionTableName}
              </option>
            ))}
          </select>
        </label>
      )}

      {(mode === "table" || mode === "extract" || mode === "sheets") && (
        <label className="block text-xs">
          <span className="font-medium text-foreground">
            {mode === "sheets" ? "Or pick by data table" : "Data table"}
          </span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={tableId || ""}
            onChange={(e) => {
              onFieldChange("tableId", e.target.value);
              if (mode === "sheets") {
                const match = exports.find(
                  (x) => x.extractionTableId === e.target.value
                );
                onFieldChange("exportId", match?.id ?? "");
              }
            }}
          >
            <option value="">
              {mode === "sheets" ? "Use sheet selection above" : "Latest table (auto)"}
            </option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {(mode === "sheets" || mode === "extract") && (
        <label className="block text-xs">
          <span className="font-medium text-foreground">Message ID</span>
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
            value={messageId ?? "{{trigger.messageId}}"}
            onChange={(e) => onFieldChange("messageId", e.target.value)}
            placeholder="{{trigger.messageId}}"
          />
          <span className="mt-1 block text-[10px] text-muted-foreground">
            Usually leave as {"{{trigger.messageId}}"} so the triggering email/WhatsApp is used.
          </span>
        </label>
      )}

      {selectedExport && (
        <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed">
          <p className="font-medium text-foreground">
            {selectedExport.label || selectedExport.sheetTitle}
          </p>
          <p className="text-muted-foreground">
            Table: {selectedExport.extractionTableName}
          </p>
          {selectedExport.spreadsheetUrl ? (
            <a
              href={selectedExport.spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block font-medium text-emerald-700 underline dark:text-emerald-300"
            >
              Open spreadsheet ↗
            </a>
          ) : (
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Sheet URL missing — open Google Sheets page and recreate/sync the export.
            </p>
          )}
          {selectedExport.lastFetchedAt && (
            <p className="mt-1 text-muted-foreground">
              Last fetched: {new Date(selectedExport.lastFetchedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <Link
        href="/google-sheets"
        className="text-[11px] text-muted-foreground underline hover:text-foreground"
      >
        Manage sheets on Google Sheets page
      </Link>
    </div>
  );
}
