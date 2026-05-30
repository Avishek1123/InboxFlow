"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExtractionDataTable } from "@/features/dashboard/components/extraction-data-table";
import { extractionTableClient } from "@/services/extraction-table-client";
import type {
  ExtractionColumn,
  ExtractionTableRecord,
  ExtractionTableRowRecord,
} from "@/types/extraction-table";
import { cn } from "@/lib/utils";

type ColumnDraft = { label: string; hint: string };

export function AiDataTablesSection() {
  const [tables, setTables] = useState<ExtractionTableRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rows, setRows] = useState<ExtractionTableRowRecord[]>([]);
  const [columns, setColumns] = useState<ExtractionColumn[]>([]);
  const [tableName, setTableName] = useState("Email leads");
  const [columnDrafts, setColumnDrafts] = useState<ColumnDraft[]>([
    { label: "Name", hint: "Sender or contact name" },
    { label: "Company", hint: "Company mentioned in email" },
    { label: "Request", hint: "What they are asking for" },
    { label: "Budget", hint: "Budget or price if mentioned" },
  ]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await extractionTableClient.list();
      setTables(items);
      if (items.length > 0) {
        setActiveId((prev) => prev ?? items[0]!.id);
        setShowEditor(false);
      } else {
        setActiveId(null);
        setColumns([]);
        setRows([]);
        setShowEditor(true);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load tables";
      setError(
        `${msg}. If you just added this feature, restart the dev server (Ctrl+C → npm run dev).`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTableDetail = useCallback(async (id: string) => {
    try {
      const { table, rows: tableRows } = await extractionTableClient.get(id);
      setColumns(table.columns);
      setRows(tableRows);
      setTableName(table.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load table");
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (activeId) loadTableDetail(activeId);
  }, [activeId, loadTableDetail]);

  async function createTable() {
    const cols = columnDrafts.filter((c) => c.label.trim());
    if (cols.length === 0) {
      setError("Add at least one column header");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { item } = await extractionTableClient.create({
        name: tableName.trim() || "Untitled table",
        columns: cols,
      });
      setTables((prev) => [item, ...prev]);
      setActiveId(item.id);
      setColumns(item.columns);
      setShowEditor(false);
      setMessage("Table created. Click “Extract from inbox” to fill rows with AI.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      setError(
        `${msg} Restart dev server if this mentions database models (Ctrl+C → npm run dev).`
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveColumns() {
    if (!activeId) return;
    const cols = columnDrafts.filter((c) => c.label.trim());
    if (cols.length === 0) return;
    setSaving(true);
    try {
      const { table } = await extractionTableClient.update(activeId, {
        name: tableName,
        columns: cols.map((c) => ({
          key: "",
          label: c.label,
          hint: c.hint || undefined,
        })),
      });
      if (table) {
        setColumns(table.columns);
        setMessage("Columns updated.");
      }
      setShowEditor(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function extractFromInbox() {
    if (!activeId) {
      setError("Create a table first");
      return;
    }
    setExtracting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await extractionTableClient.extractFromInbox(activeId, {
        limit: 15,
      });
      setRows(result.rows);
      setMessage(
        `AI extracted ${result.succeeded} row(s) from inbox emails` +
          (result.failed > 0 ? ` (${result.failed} failed — check AI keys in .env)` : "")
      );
      await loadTables();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  function addColumnDraft() {
    setColumnDrafts((prev) => [...prev, { label: "", hint: "" }]);
  }

  function updateDraft(i: number, field: keyof ColumnDraft, value: string) {
    setColumnDrafts((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c))
    );
  }

  function removeDraft(i: number) {
    setColumnDrafts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function deleteActiveTable() {
    if (!activeId) return;
    const name =
      tables.find((t) => t.id === activeId)?.name ?? "this table";
    if (
      !confirm(
        `Delete "${name}" and all extracted rows? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await extractionTableClient.delete(activeId);
      setMessage("Table deleted.");
      setActiveId(null);
      setRows([]);
      setColumns([]);
      await loadTables();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function clearActiveTableRows() {
    if (!activeId || rows.length === 0) return;
    if (!confirm("Clear all rows from this table? The table and columns stay.")) {
      return;
    }
    setDeleting(true);
    try {
      await extractionTableClient.clearRows(activeId);
      setRows([]);
      setMessage("All rows cleared.");
      await loadTables();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteRow(rowId: string) {
    if (!activeId) return;
    if (!confirm("Delete this extracted row?")) return;
    try {
      await extractionTableClient.deleteRow(activeId, rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      await loadTables();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete row failed");
    }
  }

  function openEditor() {
    setColumnDrafts(
      columns.length > 0
        ? columns.map((c) => ({ label: c.label, hint: c.hint ?? "" }))
        : columnDrafts
    );
    setShowEditor(true);
  }

  const displayColumns = columns.length > 0 ? columns : [];
  const activeTable = tables.find((t) => t.id === activeId);

  return (
    <section className="w-full space-y-5 border-t border-border pt-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              AI
            </span>
            <h2 className="text-lg font-semibold tracking-tight">
              Data tables
            </h2>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Define columns — AI extracts structured data from your Gmail inbox
            into a spreadsheet-like view.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tables.length > 0 && (
            <TablePicker
              tables={tables}
              activeId={activeId}
              onChange={setActiveId}
            />
          )}
          <ToolbarButton onClick={() => {
            setActiveId(null);
            setRows([]);
            setColumns([]);
            setShowEditor(true);
          }}>
            + New
          </ToolbarButton>
          {activeId && (
            <ToolbarButton onClick={openEditor}>Edit columns</ToolbarButton>
          )}
          {activeId && rows.length > 0 && (
            <ToolbarButton
              onClick={clearActiveTableRows}
              disabled={deleting}
              destructive
            >
              Clear rows
            </ToolbarButton>
          )}
          {activeId && (
            <ToolbarButton
              onClick={deleteActiveTable}
              disabled={deleting}
              destructive
            >
              Delete table
            </ToolbarButton>
          )}
          <button
            type="button"
            onClick={extractFromInbox}
            disabled={extracting || !activeId}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm disabled:opacity-50"
          >
            {extracting && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            )}
            {extracting ? "Extracting…" : "Extract from inbox"}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Column editor */}
      {(showEditor || tables.length === 0) && (
        <ColumnEditor
          tableName={tableName}
          onTableNameChange={setTableName}
          columnDrafts={columnDrafts}
          onUpdateDraft={updateDraft}
          onRemoveDraft={removeDraft}
          onAddColumn={addColumnDraft}
          isEdit={Boolean(activeId)}
          saving={saving}
          onSave={activeId ? saveColumns : createTable}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : displayColumns.length === 0 && !showEditor ? (
        <EmptyTableState />
      ) : displayColumns.length > 0 ? (
        <ExtractionDataTable
          columns={displayColumns}
          rows={rows}
          tableName={activeTable?.name ?? tableName}
          extracting={extracting}
          onDeleteRow={deleteRow}
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        Data from synced{" "}
        <Link href="/inbox" className="underline hover:text-foreground">
          Inbox
        </Link>{" "}
        · Click any row for full details · Requires AI keys in{" "}
        <code className="rounded bg-muted px-1">.env</code>
      </p>
    </section>
  );
}

function TablePicker({
  tables,
  activeId,
  onChange,
}: {
  tables: ExtractionTableRecord[];
  activeId: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-background p-0.5">
      {tables.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            activeId === t.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.name}
          <span className="ml-1 opacity-70">({t.rowCount ?? 0})</span>
        </button>
      ))}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm disabled:opacity-50",
        destructive
          ? "border-red-200 bg-background text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
          : "border-border bg-background hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

function ColumnEditor({
  tableName,
  onTableNameChange,
  columnDrafts,
  onUpdateDraft,
  onRemoveDraft,
  onAddColumn,
  isEdit,
  saving,
  onSave,
  onCancel,
}: {
  tableName: string;
  onTableNameChange: (v: string) => void;
  columnDrafts: ColumnDraft[];
  onUpdateDraft: (i: number, field: keyof ColumnDraft, value: string) => void;
  onRemoveDraft: (i: number) => void;
  onAddColumn: () => void;
  isEdit: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-violet-300/50 bg-violet-50/30 p-5 dark:border-violet-800/50 dark:bg-violet-950/20">
      <h3 className="text-sm font-semibold">
        {isEdit ? "Edit columns" : "Create your table"}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Headers become table columns. Hints guide the AI on what to extract.
      </p>

      <input
        value={tableName}
        onChange={(e) => onTableNameChange(e.target.value)}
        placeholder="Table name (e.g. Sales leads)"
        className="mt-4 w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {columnDrafts.map((col, i) => (
          <div
            key={i}
            className="flex gap-2 rounded-xl border border-border bg-background p-3 shadow-sm"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                value={col.label}
                onChange={(e) => onUpdateDraft(i, "label", e.target.value)}
                placeholder="Column header"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm font-medium"
              />
              <input
                value={col.hint}
                onChange={(e) => onUpdateDraft(i, "hint", e.target.value)}
                placeholder="AI hint (optional)"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
              />
            </div>
            <button
              type="button"
              onClick={() => onRemoveDraft(i)}
              className="self-start rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Remove column"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAddColumn}
          className="rounded-lg border border-dashed border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          + Add column
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Save columns" : "Create table"}
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function Alert({
  variant,
  children,
}: {
  variant: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-lg border px-4 py-2.5 text-sm",
        variant === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
          : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
      )}
    >
      {children}
    </p>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="h-14 animate-pulse bg-muted/50" />
      <div className="space-y-0">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-12 animate-pulse border-b border-border",
              i % 2 === 0 ? "bg-muted/20" : "bg-background"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyTableState() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="text-3xl">📊</p>
      <p className="mt-3 text-sm font-semibold">No data table yet</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Add column headers above — AI will parse unstructured emails into clean,
        structured rows.
      </p>
    </div>
  );
}
