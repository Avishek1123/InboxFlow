import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  processWhatsAppWebhook,
  whatsappIdempotencyKey,
} from "@/server/whatsapp/inbound";
import { whatsappRepository } from "@/server/repositories/whatsapp.repository";
import {
  extractPhoneNumberIdFromPayload,
  resolveWebhookAppSecret,
  verifyWebhookSignature,
} from "@/server/whatsapp/webhook-verify";

export const runtime = "nodejs";

/** Meta webhook verification */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const platformToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (platformToken && token === platformToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  const account = await whatsappRepository.findByWebhookVerifyToken(token);
  if (account) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let body: Parameters<typeof processWhatsAppWebhook>[0];

  try {
    body = JSON.parse(rawBody) as Parameters<typeof processWhatsAppWebhook>[0];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phoneNumberId = extractPhoneNumberIdFromPayload(body);
  const appSecret = await resolveWebhookAppSecret(phoneNumberId);
  const signature = request.headers.get("x-hub-signature-256");

  const signatureValid = verifyWebhookSignature(
    rawBody,
    signature,
    appSecret
  );

  const idempotencyKey = whatsappIdempotencyKey(body);

  const existingLog = await prisma.webhookLog.findUnique({
    where: {
      provider_idempotencyKey: {
        provider: "WHATSAPP",
        idempotencyKey,
      },
    },
  });

  if (existingLog?.status === "PROCESSED") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const account = phoneNumberId
    ? await whatsappRepository.findByPhoneNumberId(phoneNumberId)
    : null;

  const log = await prisma.webhookLog.upsert({
    where: {
      provider_idempotencyKey: {
        provider: "WHATSAPP",
        idempotencyKey,
      },
    },
    create: {
      organizationId: account?.organizationId,
      connectedAccountId: account?.id,
      provider: "WHATSAPP",
      eventType: "messages",
      signatureValid,
      idempotencyKey,
      payload: body as object,
      status: "PENDING",
    },
    update: {
      signatureValid,
      payload: body as object,
    },
  });

  if (!signatureValid && appSecret) {
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: "Invalid webhook signature",
      },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const { processed } = await processWhatsAppWebhook(body);
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
