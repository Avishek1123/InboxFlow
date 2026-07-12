import { createHash } from "crypto";
import { getSyncPipelineConfig } from "@/lib/gmail/sync-pipeline-config";
import { automationDispatcher } from "@/server/automation/dispatcher";
import { prisma } from "@/server/db";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";
import { whatsappRepository } from "@/server/repositories/whatsapp.repository";
import { runSheetSyncPipeline } from "@/server/sync-pipeline/run-sheet-sync-pipeline";

type WaMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
};

type WaChange = {
  field: string;
  value?: {
    messaging_product?: string;
    metadata?: { phone_number_id?: string; display_phone_number?: string };
    contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
    messages?: WaMessage[];
  };
};

type WaWebhookBody = {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: WaChange[];
  }>;
};

export async function processWhatsAppWebhook(
  body: WaWebhookBody
): Promise<{ processed: number }> {
  let processed = 0;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId || !value?.messages?.length) continue;

      const account = await whatsappRepository.findByPhoneNumberId(phoneNumberId);
      if (!account || account.status !== "ACTIVE") continue;

      const contactName =
        value.contacts?.[0]?.profile?.name ??
        value.contacts?.[0]?.wa_id ??
        "WhatsApp contact";

      for (const msg of value.messages) {
        if (msg.type !== "text" || !msg.text?.body) continue;

        const created = await ingestInboundMessage({
          account,
          contactName,
          msg,
        });
        if (created) processed += 1;
      }
    }
  }

  return { processed };
}

async function ingestInboundMessage(params: {
  account: Awaited<ReturnType<typeof whatsappRepository.findByPhoneNumberId>>;
  contactName: string;
  msg: WaMessage;
}): Promise<boolean> {
  const { account, contactName, msg } = params;
  if (!account) return false;

  const existing = await prisma.message.findUnique({
    where: {
      connectedAccountId_externalId: {
        connectedAccountId: account.id,
        externalId: msg.id,
      },
    },
  });
  if (existing) return false;

  const waId = msg.from;
  const receivedAt = new Date(Number(msg.timestamp) * 1000);
  const bodyText = msg.text?.body ?? "";

  const conversation = await prisma.conversation.upsert({
    where: {
      connectedAccountId_externalThreadId: {
        connectedAccountId: account.id,
        externalThreadId: waId,
      },
    },
    create: {
      organizationId: account.organizationId,
      connectedAccountId: account.id,
      channel: "WHATSAPP",
      externalThreadId: waId,
      participantPhone: waId,
      participantName: contactName,
      snippet: bodyText.slice(0, 200),
      lastMessageAt: receivedAt,
    },
    update: {
      participantName: contactName,
      snippet: bodyText.slice(0, 200),
      lastMessageAt: receivedAt,
    },
  });

  const message = await prisma.message.create({
    data: {
      organizationId: account.organizationId,
      conversationId: conversation.id,
      connectedAccountId: account.id,
      channel: "WHATSAPP",
      direction: "INBOUND",
      externalId: msg.id,
      externalThreadId: waId,
      whatsappMessageType: "TEXT",
      fromAddress: waId,
      bodyText,
      receivedAt,
      hasAttachments: false,
    },
  });

  await prisma.connectedAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date(), syncStatus: "IDLE" },
  });

  await automationDispatcher.dispatch({
    organizationId: account.organizationId,
    triggerType: "NEW_WHATSAPP_MESSAGE",
    payload: {
      messageId: message.id,
      conversationId: conversation.id,
      channel: "WHATSAPP",
      from: waId,
      body: bodyText,
      receivedAt: receivedAt.toISOString(),
      contactName,
    },
  });

  const pipelineConfig = getSyncPipelineConfig();
  const hasSheetExports =
    (await sheetExportRepository.list(account.organizationId)).length > 0;
  if (pipelineConfig.whatsappEnabled && hasSheetExports) {
    runSheetSyncPipeline(account.organizationId, {
      extractLimit: pipelineConfig.extractLimit,
      messageIds: [message.id],
    }).catch((err) => {
      console.error("[whatsapp/inbound] sheet-sync-pipeline", err);
    });
  }

  return true;
}

export function whatsappIdempotencyKey(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}
