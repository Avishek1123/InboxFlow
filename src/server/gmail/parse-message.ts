import type { gmail_v1 } from "googleapis";

export type ParsedGmailMessage = {
  externalId: string;
  externalThreadId: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date;
  labels: string[];
  snippet: string | null;
  hasAttachments: boolean;
};

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  const h = headers?.find(
    (x) => x.name?.toLowerCase() === name.toLowerCase()
  );
  return h?.value ?? "";
}

function decodeBody(data?: string | null): string {
  if (!data) return "";
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractBodies(part: gmail_v1.Schema$MessagePart | undefined): {
  text: string | null;
  html: string | null;
  hasAttachments: boolean;
} {
  if (!part) return { text: null, html: null, hasAttachments: false };

  let text: string | null = null;
  let html: string | null = null;
  let hasAttachments = false;

  if (part.filename && part.body?.attachmentId) {
    hasAttachments = true;
  }

  if (part.mimeType === "text/plain" && part.body?.data) {
    text = decodeBody(part.body.data);
  } else if (part.mimeType === "text/html" && part.body?.data) {
    html = decodeBody(part.body.data);
  }

  for (const child of part.parts ?? []) {
    const nested = extractBodies(child);
    text = text ?? nested.text;
    html = html ?? nested.html;
    hasAttachments = hasAttachments || nested.hasAttachments;
  }

  return { text, html, hasAttachments };
}

export function parseGmailMessage(
  msg: gmail_v1.Schema$Message
): ParsedGmailMessage | null {
  if (!msg.id || !msg.threadId) return null;

  const headers = msg.payload?.headers;
  const fromRaw = getHeader(headers, "From");
  const fromMatch = fromRaw.match(/<([^>]+)>/) ?? [null, fromRaw];
  const fromAddress = (fromMatch[1] ?? fromRaw).trim();

  const toRaw = getHeader(headers, "To");
  const toAddresses = toRaw
    ? toRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const ccRaw = getHeader(headers, "Cc");
  const ccAddresses = ccRaw
    ? ccRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const subject = getHeader(headers, "Subject") || null;
  const dateHeader = getHeader(headers, "Date");
  const receivedAt = dateHeader ? new Date(dateHeader) : new Date(Number(msg.internalDate));

  const { text, html, hasAttachments } = extractBodies(msg.payload);

  return {
    externalId: msg.id,
    externalThreadId: msg.threadId,
    fromAddress,
    toAddresses,
    ccAddresses,
    subject,
    bodyText: text ?? msg.snippet ?? null,
    bodyHtml: html,
    receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    labels: msg.labelIds ?? [],
    snippet: msg.snippet ?? null,
    hasAttachments,
  };
}
