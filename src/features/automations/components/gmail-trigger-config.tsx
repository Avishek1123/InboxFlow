"use client";

import {
  GMAIL_FILTER_PRESETS,
} from "@/lib/gmail/trigger-filters";
import type { GmailFilterMode, GmailFilterPresetId } from "@/types/gmail";
import type { WorkflowNodeData } from "@/types/automation";
import { cn } from "@/lib/utils";

type Props = {
  config: WorkflowNodeData["config"];
  onChange: (config: WorkflowNodeData["config"]) => void;
};

export function GmailTriggerConfig({ config, onChange }: Props) {
  const presetIds =
    (config.filterPresetIds as GmailFilterPresetId[] | undefined) ?? [];
  const mode = (config.filterMode as GmailFilterMode | undefined) ?? "any";

  function setPresets(ids: GmailFilterPresetId[]) {
    onChange({
      ...config,
      filterPresetIds: ids,
      filterLabels: [], // legacy — presets take precedence
    });
  }

  function toggle(id: GmailFilterPresetId) {
    const next = presetIds.includes(id)
      ? presetIds.filter((x) => x !== id)
      : [...presetIds, id];
    setPresets(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Override workspace Gmail filters for this workflow. Leave empty to use
        settings from Integrations → Gmail.
      </p>

      <div className="flex gap-1">
        {(["any", "all"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange({ ...config, filterMode: m })}
            className={cn(
              "flex-1 rounded-md border px-2 py-1 text-[10px] font-medium capitalize",
              mode === m
                ? "border-primary bg-primary/10"
                : "border-border"
            )}
          >
            {m === "any" ? "Any" : "All"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {GMAIL_FILTER_PRESETS.map((p) => {
          const on = presetIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px]",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {presetIds.length === 0 && (
        <p className="text-[10px] italic text-muted-foreground">
          Using default filters from Gmail integration page.
        </p>
      )}
    </div>
  );
}
