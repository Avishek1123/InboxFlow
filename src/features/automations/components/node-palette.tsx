"use client";

import { useMemo, useState } from "react";
import { GmailIcon } from "@/components/icons/gmail-icon";
import { TwilioIcon } from "@/components/icons/twilio-icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import {
  CATALOG_ACTIONS,
  CATALOG_TRIGGERS,
  NODE_APPS,
  catalogNodesByApp,
  filterCatalogNodes,
  resolveNodeIntegration,
  type CatalogNode,
} from "@/lib/automation/node-catalog";
import type { IntegrationRequirement, NodeDefinition } from "@/lib/automation/definitions";
import type { NodeAppId } from "@/lib/automation/definitions";

type Props = {
  onAdd: (def: NodeDefinition) => void;
  isConnected: (req: IntegrationRequirement) => boolean;
};

type Tab = "trigger" | "action";

export function NodePalette({ onAdd, isConnected }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("trigger");
  const [expandedApp, setExpandedApp] = useState<NodeAppId | "all">("all");

  const nodes = tab === "trigger" ? CATALOG_TRIGGERS : CATALOG_ACTIONS;
  const filtered = useMemo(
    () => filterCatalogNodes(nodes, query),
    [nodes, query]
  );
  const byApp = useMemo(() => catalogNodesByApp(filtered), [filtered]);

  const visibleApps = NODE_APPS.filter(
    (app) => (byApp.get(app.id)?.length ?? 0) > 0
  );

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="border-b border-border p-3">
        <p className="text-xs font-semibold text-foreground">Add node</p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes…"
          className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="mt-2 flex rounded-lg border border-border p-0.5">
          <TabButton active={tab === "trigger"} onClick={() => setTab("trigger")}>
            Triggers
          </TabButton>
          <TabButton active={tab === "action"} onClick={() => setTab("action")}>
            Actions
          </TabButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No nodes match your search
          </p>
        ) : query ? (
          <div className="space-y-1">
            {filtered.map((node) => (
              <PaletteNode
                key={node.kind}
                node={node}
                onAdd={onAdd}
                isConnected={isConnected}
              />
            ))}
          </div>
        ) : (
          visibleApps.map((app) => {
            const appNodes = byApp.get(app.id) ?? [];
            const open = expandedApp === "all" || expandedApp === app.id;
            return (
              <div key={app.id} className="mb-1">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedApp((prev) =>
                      prev === app.id ? "all" : app.id
                    )
                  }
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
                >
                  <AppIcon app={app.id} size={18} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">{app.label}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {appNodes.length} {tab === "trigger" ? "trigger" : "action"}
                      {appNodes.length !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {open ? "▾" : "▸"}
                  </span>
                </button>
                {open && (
                  <div className="mb-2 ml-1 space-y-1 border-l border-border pl-2">
                    {appNodes.map((node) => (
                      <PaletteNode
                        key={node.kind}
                        node={node}
                        onAdd={onAdd}
                        isConnected={isConnected}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PaletteNode({
  node,
  onAdd,
  isConnected,
  compact,
}: {
  node: CatalogNode;
  onAdd: (def: NodeDefinition) => void;
  isConnected: (req: IntegrationRequirement) => boolean;
  compact?: boolean;
}) {
  const req = resolveNodeIntegration(node, node.defaultConfig);
  const needsSetup = req ? !isConnected(req) : false;

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/reactflow", JSON.stringify(node));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onAdd(node)}
      className={`flex w-full gap-2 rounded-md border border-border text-left hover:bg-muted ${
        compact ? "px-2 py-1.5" : "px-2 py-2"
      }`}
      style={{ borderLeftColor: node.color, borderLeftWidth: 3 }}
    >
      <AppIcon app={node.app} size={compact ? 14 : 16} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-xs font-medium">
          {node.label}
          {needsSetup && (
            <span className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Setup
            </span>
          )}
        </span>
        {!compact && (
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground line-clamp-2">
            {node.description}
          </span>
        )}
      </span>
    </button>
  );
}

function AppIcon({ app, size }: { app: NodeAppId; size: number }) {
  if (app === "gmail") {
    return (
      <span className="mt-0.5 shrink-0">
        <GmailIcon size={size} />
      </span>
    );
  }
  if (app === "twilio") {
    return (
      <span className="mt-0.5 shrink-0">
        <TwilioIcon size={size} />
      </span>
    );
  }
  if (app === "messages") {
    return (
      <span className="mt-0.5 shrink-0">
        <WhatsAppIcon size={size} />
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 flex shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {app.slice(0, 1).toUpperCase()}
    </span>
  );
}
