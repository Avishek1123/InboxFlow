"use client";

import { useMemo, useState } from "react";
import type {
  ExtractionColumn,
  ExtractionTableRowRecord,
} from "@/types/extraction-table";
import { cn } from "@/lib/utils";

type SortKey = "from" | "subject" | "date" | string;

type Props = {
  columns: ExtractionColumn[];
  rows: ExtractionTableRowRecord[];
  tableName: string;
  extracting?: boolean;
  onDeleteRow?: (rowId: string) => void;
};

export function ExtractionDataTable({
  columns,
  rows,
  tableName,
  extracting,
  onDeleteRow,
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = rows.filter((row) => {
        const haystack = [
          row.sourceFrom,
          row.sourceSubject,
          row.sourceSnippet,
          ...columns.map((c) => cellText(row.values[c.key])),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortKey === "from") {
        av = a.sourceFrom ?? "";
        bv = b.sourceFrom ?? "";
      } else if (sortKey === "subject") {
        av = a.sourceSubject ?? "";
        bv = b.sourceSubject ?? "";
      } else if (sortKey === "date") {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        av = cellText(a.values[sortKey]);
        bv = cellText(b.values[sortKey]);
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [rows, columns, search, sortKey, sortAsc]);

  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  const filledCells = useMemo(() => {
    if (rows.length === 0) return 0;
    const total = rows.length * columns.length;
    const filled = rows.reduce((acc, row) => {
      return (
        acc + columns.filter((c) => Boolean(cellText(row.values[c.key]))).length
      );
    }, 0);
    return Math.round((filled / total) * 100);
  }, [rows, columns]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function exportCsv() {
    const headers = [
      "From",
      "Subject",
      "Received",
      ...columns.map((c) => c.label),
    ];
    const lines = filtered.map((row) => {
      const cells = [
        row.sourceFrom ?? "",
        row.sourceSubject ?? "",
        new Date(row.createdAt).toISOString(),
        ...columns.map((c) => cellText(row.values[c.key])),
      ];
      return cells.map(escapeCsv).join(",");
    });
    const csv = [headers.map(escapeCsv).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableName.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      {/* Table toolbar */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            AI
          </div>
          <div>
            <p className="text-sm font-semibold">{tableName}</p>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {rows.length} rows · {filledCells}% cells
              filled
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rows…"
              className="w-full min-w-[180px] rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm sm:w-52"
            />
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              ⌕
            </span>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </div>

      {extracting && (
        <div className="border-b border-border bg-primary/5 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-primary">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            AI is extracting data from your inbox…
          </div>
        </div>
      )}

      <div className="flex min-h-[280px] flex-col lg:flex-row">
        {/* Table */}
        <div className="scrollbar-subtle min-w-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
              <tr className="border-b border-border">
                <th className="w-10 px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  #
                </th>
                <SortHeader
                  label="From"
                  active={sortKey === "from"}
                  asc={sortAsc}
                  onClick={() => toggleSort("from")}
                  className="min-w-[120px]"
                />
                <SortHeader
                  label="Subject"
                  active={sortKey === "subject"}
                  asc={sortAsc}
                  onClick={() => toggleSort("subject")}
                  className="min-w-[140px]"
                />
                {columns.map((col) => (
                  <SortHeader
                    key={col.key}
                    label={col.label}
                    hint={col.hint}
                    active={sortKey === col.key}
                    asc={sortAsc}
                    onClick={() => toggleSort(col.key)}
                    className="min-w-[130px]"
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 3}
                    className="px-4 py-16 text-center"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {rows.length === 0
                        ? "No extracted data yet"
                        : "No rows match your search"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rows.length === 0
                        ? 'Click "Extract from inbox" to populate this table.'
                        : "Try a different search term."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() =>
                      setSelectedId((id) => (id === row.id ? null : row.id))
                    }
                    className={cn(
                      "cursor-pointer border-b border-border transition-colors",
                      selectedId === row.id
                        ? "bg-primary/8 hover:bg-primary/10"
                        : i % 2 === 0
                          ? "bg-background hover:bg-muted/40"
                          : "bg-muted/15 hover:bg-muted/40"
                    )}
                  >
                    <td className="px-3 py-3 text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase">
                          {initials(row.sourceFrom)}
                        </span>
                        <span
                          className="block min-w-0 truncate text-xs"
                          title={row.sourceFrom ?? undefined}
                        >
                          {row.sourceFrom ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td
                      className="min-w-0 truncate px-3 py-3 text-xs font-medium"
                      title={row.sourceSubject ?? undefined}
                    >
                      {row.sourceSubject ?? "—"}
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-3 py-3">
                        <CellValue value={row.values[col.key]} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <aside className="w-full shrink-0 border-t border-border bg-muted/20 lg:w-96 lg:border-l lg:border-t-0 xl:w-[28rem]">
            <RowDetail
              row={selected}
              columns={columns}
              onClose={() => setSelectedId(null)}
              onDelete={
                onDeleteRow
                  ? () => {
                      onDeleteRow(selected.id);
                      setSelectedId(null);
                    }
                  : undefined
              }
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  hint,
  active,
  asc,
  onClick,
  className,
}: {
  label: string;
  hint?: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={cn("px-3 py-3 text-left", className)}>
      <button
        type="button"
        onClick={onClick}
        title={hint}
        className="group flex items-center gap-1 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <span className={cn(active && "text-foreground")}>{label}</span>
        <span className="text-[8px] opacity-60 group-hover:opacity-100">
          {active ? (asc ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function CellValue({
  value,
}: {
  value: string | number | boolean | null | undefined;
}) {
  const text = cellText(value);
  if (!text.trim()) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  return (
    <span className="line-clamp-2 text-xs leading-relaxed" title={text}>
      {text}
    </span>
  );
}

function RowDetail({
  row,
  columns,
  onClose,
  onDelete,
}: {
  row: ExtractionTableRowRecord;
  columns: ExtractionColumn[];
  onClose: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Row detail
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug">
            {row.sourceSubject ?? "(no subject)"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.sourceFrom} · {formatDate(row.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              Delete row
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {row.sourceSnippet && (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            Email snippet
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {row.sourceSnippet}
          </p>
        </div>
      )}

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">
          Extracted fields
        </p>
        {columns.map((col) => (
          <div
            key={col.key}
            className="rounded-lg border border-border bg-background p-3"
          >
            <p className="text-xs font-medium text-foreground">{col.label}</p>
            {col.hint && (
              <p className="text-[10px] text-muted-foreground">{col.hint}</p>
            )}
            <p className="mt-1.5 text-sm leading-relaxed">
              {cellText(row.values[col.key]).trim() || (
                <span className="text-muted-foreground">Not found in email</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function initials(email: string | null | undefined): string {
  if (!email) return "?";
  const name = email.split("@")[0] ?? email;
  return name.slice(0, 2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cellText(
  value: string | number | boolean | null | undefined
): string {
  if (value == null) return "";
  return String(value);
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
