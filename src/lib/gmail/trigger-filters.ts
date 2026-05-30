/**
 * Gmail message filter presets for sync queries and automation triggers.
 * Label IDs match Gmail API labelIds on messages.
 */

import type {
  GmailFilterMode,
  GmailFilterPresetId,
  GmailTriggerSettings,
} from "@/types/gmail";

export type { GmailFilterMode, GmailFilterPresetId, GmailTriggerSettings };

export type GmailFilterPreset = {
  id: GmailFilterPresetId;
  label: string;
  description: string;
  /** Gmail search query fragment */
  query: string;
  /** Gmail API labelId for trigger matching */
  labelId: string;
};

export const GMAIL_FILTER_PRESETS: GmailFilterPreset[] = [
  {
    id: "INBOX",
    label: "Inbox",
    description: "Messages in your inbox",
    query: "in:inbox",
    labelId: "INBOX",
  },
  {
    id: "STARRED",
    label: "Starred",
    description: "Starred messages",
    query: "is:starred",
    labelId: "STARRED",
  },
  {
    id: "IMPORTANT",
    label: "Important",
    description: "Marked important by Gmail",
    query: "is:important",
    labelId: "IMPORTANT",
  },
  {
    id: "UNREAD",
    label: "Unread",
    description: "Unread messages only",
    query: "is:unread",
    labelId: "UNREAD",
  },
  {
    id: "SENT",
    label: "Sent",
    description: "Sent mail",
    query: "in:sent",
    labelId: "SENT",
  },
  {
    id: "PERSONAL",
    label: "Personal",
    description: "Personal category tab",
    query: "category:personal",
    labelId: "CATEGORY_PERSONAL",
  },
  {
    id: "PROMOTIONS",
    label: "Promotions",
    description: "Promotions category tab",
    query: "category:promotions",
    labelId: "CATEGORY_PROMOTIONS",
  },
  {
    id: "SOCIAL",
    label: "Social",
    description: "Social category tab",
    query: "category:social",
    labelId: "CATEGORY_SOCIAL",
  },
  {
    id: "UPDATES",
    label: "Updates",
    description: "Updates category tab",
    query: "category:updates",
    labelId: "CATEGORY_UPDATES",
  },
];

export type GmailAccountMetadata = {
  triggerFilters?: GmailTriggerSettings;
};

export function parseGmailMetadata(metadata: unknown): GmailAccountMetadata {
  if (!metadata || typeof metadata !== "object") return {};
  return metadata as GmailAccountMetadata;
}

export function getTriggerSettings(
  metadata: unknown
): GmailTriggerSettings {
  const parsed = parseGmailMetadata(metadata);
  return (
    parsed.triggerFilters ?? {
      filterIds: ["INBOX"],
      mode: "any",
    }
  );
}

export function presetById(id: GmailFilterPresetId): GmailFilterPreset | undefined {
  return GMAIL_FILTER_PRESETS.find((p) => p.id === id);
}

export function labelIdsFromFilterIds(ids: GmailFilterPresetId[]): string[] {
  return ids
    .map((id) => presetById(id)?.labelId)
    .filter((x): x is string => Boolean(x));
}

/** Gmail API `q` parameter for messages.list */
export function buildSyncQuery(settings: GmailTriggerSettings): string {
  const presets = settings.filterIds
    .map((id) => presetById(id))
    .filter((p): p is GmailFilterPreset => Boolean(p));

  if (presets.length === 0) {
    return "in:inbox newer_than:30d";
  }

  const parts = presets.map((p) => p.query);
  const combined =
    settings.mode === "all" ? parts.join(" ") : `(${parts.join(" OR ")})`;

  return `${combined} newer_than:30d`;
}

/** Effective label filter for automation dispatch */
export function messageMatchesTriggerFilters(
  messageLabels: string[],
  settings: GmailTriggerSettings
): boolean {
  if (settings.filterIds.length === 0) return true;

  const required = labelIdsFromFilterIds(settings.filterIds);
  if (required.length === 0) return true;

  if (settings.mode === "all") {
    return required.every((id) => messageLabels.includes(id));
  }
  return required.some((id) => messageLabels.includes(id));
}

export function resolveAutomationFilterLabels(
  automationFilterLabels: string[] | undefined,
  accountSettings: GmailTriggerSettings
): string[] {
  if (automationFilterLabels && automationFilterLabels.length > 0) {
    return automationFilterLabels;
  }
  return labelIdsFromFilterIds(accountSettings.filterIds);
}
