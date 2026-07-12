import { createHash, createHmac, timingSafeEqual } from "crypto";
import { automationDispatcher } from "@/server/automation/dispatcher";
import { prisma } from "@/server/db";
import { twilioRepository } from "@/server/repositories/twilio.repository";
import type { AutomationTriggerType } from "@prisma/client";

type TwilioInboundParams = Record<string, string>;

function isWhatsAppAddress(value: string): boolean {
  return value.toLowerCase().startsWith("whatsapp:");
}

function stripWhatsAppPrefix(value: string): string {
  return value.replace(/^whatsapp:/i, "");
}

export async function processTwilioInboundWebhook(
  params: TwilioInboundParams
): Promise<{ processed: boolean; triggerType?: AutomationTriggerType }> {
  const accountSid = params.AccountSid;
  const messageSid = params.MessageSid;
  const from = params.From ?? "";
  const body = params.Body ?? "";

  if (!accountSid || !messageSid || !from) {
    return { processed: false };
  }

  const account = await twilioRepository.findByAccountSid(accountSid);
  if (!account || account.status !== "ACTIVE") {
    return { processed: false };
  }

  const isWhatsApp = isWhatsAppAddress(from);
  const channel = isWhatsApp ? ("WHATSAPP" as const) : ("SMS" as const);
  const triggerType: AutomationTriggerType = isWhatsApp
    ? "NEW_TWILIO_WHATSAPP"
    : "NEW_SMS";
  const fromAddress = stripWhatsAppPrefix(from);

  const existing = await prisma.message.findUnique({
    where: {
      connectedAccountId_externalId: {
        connectedAccountId: account.id,
        externalId: messageSid,
      },
    },
  });
  if (existing) return { processed: false, triggerType };

  const receivedAt = new Date();
  const conversation = await prisma.conversation.upsert({
    where: {
      connectedAccountId_externalThreadId: {
        connectedAccountId: account.id,
        externalThreadId: fromAddress,
      },
    },
    create: {
      organizationId: account.organizationId,
      connectedAccountId: account.id,
      channel,
      externalThreadId: fromAddress,
      participantPhone: fromAddress,
      participantName: fromAddress,
      snippet: body.slice(0, 200),
      lastMessageAt: receivedAt,
    },
    update: {
      snippet: body.slice(0, 200),
      lastMessageAt: receivedAt,
    },
  });

  const message = await prisma.message.create({
    data: {
      organizationId: account.organizationId,
      conversationId: conversation.id,
      connectedAccountId: account.id,
      channel,
      direction: "INBOUND",
      externalId: messageSid,
      externalThreadId: fromAddress,
      fromAddress,
      bodyText: body,
      receivedAt,
      hasAttachments: false,
    },
  });

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: receivedAt, syncStatus: "IDLE" },
  });

  await automationDispatcher.dispatch({
    organizationId: account.organizationId,
    triggerType,
    payload: {
      messageId: message.id,
      conversationId: conversation.id,
      channel,
      from: fromAddress,
      body,
      receivedAt: receivedAt.toISOString(),
      provider: "twilio",
    },
  });

  return { processed: true, triggerType };
}

export function twilioIdempotencyKey(params: TwilioInboundParams): string {
  return createHash("sha256")
    .update(JSON.stringify(params))
    .digest("hex");
}

export function verifyTwilioSignature(
  authToken: string,
  signature: string | null,
  url: string,
  params: TwilioInboundParams
): boolean {
  if (!signature || !authToken) return !authToken;

  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
