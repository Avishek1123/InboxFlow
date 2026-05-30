"use client";

import { useState } from "react";
import {
  GMAIL_FILTER_PRESETS,
  buildSyncQuery,
} from "@/lib/gmail/trigger-filters";
import { gmailClient } from "@/services/gmail-client";
import type { GmailFilterMode, GmailFilterPresetId, GmailTriggerSettings } from "@/types/gmail";
import { cn } from "@/lib/utils";

type Props = {
  initial: GmailTriggerSettings;
  onSaved?: (settings: GmailTriggerSettings) => void;
};

export function GmailTriggerFilters({ initial, onSaved }: Props) {
  const [filterIds, setFilterIds] = useState<GmailFilterPresetId[]>(
    initial.filterIds.length > 0 ? initial.filterIds : ["INBOX"]
  );
  const [mode, setMode] = useState<GmailFilterMode>(initial.mode ?? "any");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggle(id: GmailFilterPresetId) {
    setFilterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function save() {
    if (filterIds.length === 0) {
      setMessage("Select at least one filter.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await gmailClient.updateTriggers({ filterIds, mode });
      onSaved?.(res.triggerFilters);
      setMessage("Trigger filters saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const previewQuery = buildSyncQuery({ filterIds, mode });

  return (
    <section className="rounded-2xl border border-border p-6">
      <div>
        <h3 className="text-sm font-semibold">Message triggers</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose which Gmail messages sync and fire automations (starred, important,
          inbox, etc.).
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        <ModeButton
          active={mode === "any"}
          label="Match any"
          hint="Starred OR Important"
          onClick={() => setMode("any")}
        />
        <ModeButton
          active={mode === "all"}
          label="Match all"
          hint="Starred AND Important"
          onClick={() => setMode("all")}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {GMAIL_FILTER_PRESETS.map((preset) => {
          const checked = filterIds.includes(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => toggle(preset.id)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                checked
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border"
                )}
              >
                {checked ? "✓" : ""}
              </span>
              <span>
                <span className="text-sm font-medium">{preset.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {preset.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Sync query preview: </span>
        <code className="break-all">{previewQuery}</code>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Matching messages appear in{" "}
        <a href="/inbox" className="font-medium text-foreground underline">
          Inbox
        </a>{" "}
        after you sync.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save trigger filters"}
        </button>
        {message && (
          <span className="text-xs text-muted-foreground">{message}</span>
        )}
      </div>
    </section>
  );
}

function ModeButton({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg border px-3 py-2 text-left",
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="block text-[10px] text-muted-foreground">{hint}</span>
    </button>
  );
}
