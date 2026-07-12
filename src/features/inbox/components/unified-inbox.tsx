"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GMAIL_FILTER_PRESETS } from "@/lib/gmail/trigger-filters";
import { gmailClient } from "@/services/gmail-client";
import { inboxClient } from "@/services/inbox-client";
import type { InboxMessageItem } from "@/types/inbox";
import type { GmailFilterPresetId } from "@/types/gmail";
import { ChannelIcon } from "@/components/icons";
import { GmailIcon } from "@/components/icons/gmail-icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { cn } from "@/lib/utils";

export function UnifiedInbox() {
  const [messages, setMessages] = useState<InboxMessageItem[]>([]);
  const [filterSummary, setFilterSummary] = useState("");
  const [activeFilterIds, setActiveFilterIds] = useState<GmailFilterPresetId[]>(
    []
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<"ALL" | "GMAIL" | "WHATSAPP">("GMAIL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await inboxClient.list(
        channel === "ALL" ? undefined : channel
      );
      setMessages(res.messages);
      setFilterSummary(res.filterSummary);
      setActiveFilterIds(res.activeFilters.filterIds);
      setSelectedId((prev) => {
        if (prev && res.messages.some((m) => m.id === prev)) return prev;
        return res.messages[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await gmailClient.sync();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const selected = messages.find((m) => m.id === selectedId);

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[480px] w-full flex-col overflow-hidden rounded-2xl border border-border bg-background">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium">{filterSummary}</p>
          <p className="text-xs text-muted-foreground">
            {messages.length} message{messages.length !== 1 ? "s" : ""} — change
            filters on{" "}
            <Link href="/integrations/gmail" className="underline">
              Gmail settings
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChannelTabs value={channel} onChange={setChannel} />
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync Gmail"}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterIds.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-border px-4 py-2">
          {activeFilterIds.map((id) => {
            const preset = GMAIL_FILTER_PRESETS.find((p) => p.id === id);
            return (
              <span
                key={id}
                className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {preset?.label ?? id}
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <p className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Message list */}
        <div className="scrollbar-subtle w-[min(100%,28rem)] shrink-0 overflow-y-auto border-r border-border md:w-80 lg:w-96 xl:w-[28rem]">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading messages…</p>
          ) : messages.length === 0 ? (
            <EmptyInbox
              filterSummary={filterSummary}
              onSync={handleSync}
              syncing={syncing}
            />
          ) : (
            <ul>
              {messages.map((msg) => (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(msg.id)}
                    className={cn(
                      "w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      selectedId === msg.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {msg.fromAddress}
                      </p>
                      <time className="shrink-0 text-[10px] text-muted-foreground">
                        {formatDate(msg.receivedAt)}
                      </time>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-medium text-foreground/90">
                      {msg.subject ?? "(no subject)"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {msg.snippet ?? msg.bodyText ?? ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {msg.isExtracted && (
                        <LabelChip
                          variant="extracted"
                          title={
                            msg.extractedTableNames.length > 0
                              ? `In: ${msg.extractedTableNames.join(", ")}`
                              : undefined
                          }
                        >
                          ✓ Extracted
                        </LabelChip>
                      )}
                      {msg.labels.includes("STARRED") && (
                        <LabelChip>★ Starred</LabelChip>
                      )}
                      {msg.labels.includes("IMPORTANT") && (
                        <LabelChip>Important</LabelChip>
                      )}
                      {msg.channel === "GMAIL" && (
                        <LabelChip muted icon={<GmailIcon size={12} />}>
                          Gmail
                        </LabelChip>
                      )}
                      {msg.channel === "WHATSAPP" && (
                        <LabelChip muted icon={<WhatsAppIcon size={12} />}>
                          WhatsApp
                        </LabelChip>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail pane */}
        <div className="scrollbar-subtle min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          {selected ? (
            <MessageDetail message={selected} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a message to read
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageDetail({ message }: { message: InboxMessageItem }) {
  return (
    <article className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">
          {message.subject ?? "(no subject)"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          From <span className="text-foreground">{message.fromAddress}</span>
          {" · "}
          {new Date(message.receivedAt).toLocaleString()}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <LabelChip
            muted
            icon={
              message.channel === "WHATSAPP" ? (
                <WhatsAppIcon size={12} />
              ) : (
                <GmailIcon size={12} />
              )
            }
          >
            {message.channel === "WHATSAPP" ? "WhatsApp" : "Gmail"}
          </LabelChip>
          {message.isExtracted && (
            <LabelChip variant="extracted">
              ✓ Extracted to data table
            </LabelChip>
          )}
          {message.labels.map((l) => (
            <LabelChip key={l}>{l.replace("CATEGORY_", "")}</LabelChip>
          ))}
        </div>
        {message.isExtracted && message.extractedTableNames.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Saved in:{" "}
            {message.extractedTableNames.map((name, i) => (
              <span key={name}>
                {i > 0 && ", "}
                <Link
                  href="/dashboard"
                  className="font-medium text-violet-700 underline dark:text-violet-300"
                >
                  {name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </header>
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
        {message.bodyText ?? message.snippet ?? "No content"}
      </div>
    </article>
  );
}

function EmptyInbox({
  filterSummary,
  onSync,
  syncing,
}: {
  filterSummary: string;
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="p-6 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">No messages yet</p>
      <p className="mt-2">
        {filterSummary}. Sync Gmail to load matching messages into your inbox.
      </p>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {syncing ? "Syncing…" : "Sync Gmail now"}
      </button>
      <p className="mt-3">
        <Link href="/integrations/gmail" className="underline">
          Configure triggers (starred, important…)
        </Link>
      </p>
    </div>
  );
}

function ChannelTabs({
  value,
  onChange,
}: {
  value: "ALL" | "GMAIL" | "WHATSAPP";
  onChange: (v: "ALL" | "GMAIL" | "WHATSAPP") => void;
}) {
  const tabs = [
    { id: "GMAIL" as const, label: "Gmail", icon: <GmailIcon size={14} /> },
    { id: "ALL" as const, label: "All", icon: null },
    { id: "WHATSAPP" as const, label: "WhatsApp", icon: <WhatsAppIcon size={14} /> },
  ];
  return (
    <div className="flex rounded-lg border border-border p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
            value === t.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

function LabelChip({
  children,
  muted,
  variant,
  title,
  icon,
}: {
  children: React.ReactNode;
  muted?: boolean;
  variant?: "extracted";
  title?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]",
        variant === "extracted" &&
          "bg-violet-100 font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200",
        muted && "bg-muted text-muted-foreground",
        !muted &&
          variant !== "extracted" &&
          "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      )}
    >
      {children}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
