"use client";

import type { NodeDefinition } from "@/lib/automation/definitions";

type Props = {
  triggers: NodeDefinition[];
  actions: NodeDefinition[];
  onAdd: (def: NodeDefinition) => void;
};

export function NodePalette({ triggers, actions, onAdd }: Props) {
  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-sidebar p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Triggers
      </p>
      <div className="space-y-1">
        {triggers.map((t) => (
          <PaletteItem key={t.kind} def={t} onAdd={onAdd} />
        ))}
      </div>
      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Actions
      </p>
      <div className="space-y-1 overflow-y-auto">
        {actions.map((a) => (
          <PaletteItem key={a.kind} def={a} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}

function PaletteItem({
  def,
  onAdd,
}: {
  def: NodeDefinition;
  onAdd: (d: NodeDefinition) => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/reactflow", JSON.stringify(def));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onAdd(def)}
      className="w-full rounded-md border border-border px-2 py-2 text-left text-xs hover:bg-muted"
      style={{ borderLeftColor: def.color, borderLeftWidth: 3 }}
    >
      <span className="font-medium">{def.label}</span>
      <span className="mt-0.5 block text-[10px] text-muted-foreground line-clamp-2">
        {def.description}
      </span>
    </button>
  );
}
