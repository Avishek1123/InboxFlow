"use client";

export type ColumnHeaderDraft = {
  label: string;
  hint: string;
};

type Props = {
  drafts: ColumnHeaderDraft[];
  onChange: (drafts: ColumnHeaderDraft[]) => void;
  disabled?: boolean;
};

export function ColumnHeadersEditor({ drafts, onChange, disabled }: Props) {
  function updateDraft(index: number, field: keyof ColumnHeaderDraft, value: string) {
    onChange(
      drafts.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  }

  function removeDraft(index: number) {
    onChange(drafts.filter((_, i) => i !== index));
  }

  function addColumn() {
    onChange([...drafts, { label: "", hint: "" }]);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        These headers appear as the first row in your Google Sheet. AI uses them
        when extracting from Gmail and WhatsApp.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {drafts.map((col, i) => (
          <div
            key={i}
            className="flex gap-2 rounded-xl border border-border bg-muted/30 p-3"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background text-[10px] font-bold text-muted-foreground">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                value={col.label}
                onChange={(e) => updateDraft(i, "label", e.target.value)}
                placeholder="Column header (e.g. Customer name)"
                disabled={disabled}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-medium disabled:opacity-50"
              />
              <input
                value={col.hint}
                onChange={(e) => updateDraft(i, "hint", e.target.value)}
                placeholder="AI hint (optional)"
                disabled={disabled}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={() => removeDraft(i)}
              disabled={disabled || drafts.length <= 1}
              className="self-start rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              aria-label="Remove column"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addColumn}
        disabled={disabled}
        className="rounded-lg border border-dashed border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      >
        + Add header
      </button>
    </div>
  );
}

export const DEFAULT_COLUMN_HEADER_DRAFTS: ColumnHeaderDraft[] = [
  { label: "From", hint: "Sender phone number or email" },
  { label: "Subject", hint: "Email subject or chat topic" },
  { label: "Summary", hint: "Short summary of the message" },
];

export function draftsFromTableColumns(
  columns: Array<{ label: string; hint?: string }>
): ColumnHeaderDraft[] {
  if (columns.length === 0) return [...DEFAULT_COLUMN_HEADER_DRAFTS];
  return columns.map((c) => ({ label: c.label, hint: c.hint ?? "" }));
}

export function draftsToColumnPayload(
  drafts: ColumnHeaderDraft[],
  existingColumns?: Array<{ label: string; hint?: string; key?: string }>
): Array<{ label: string; hint?: string; key?: string }> {
  const trimmed = drafts.filter((d) => d.label.trim());
  return trimmed.map((d, i) => {
    const byLabel = existingColumns?.find(
      (c) => c.label.toLowerCase() === d.label.trim().toLowerCase()
    );
    const byIndex = existingColumns?.[i];
    return {
      label: d.label.trim(),
      hint: d.hint.trim() || undefined,
      key: byLabel?.key ?? byIndex?.key,
    };
  });
}
