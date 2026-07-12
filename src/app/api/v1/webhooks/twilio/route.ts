import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { twilioRepository } from "@/server/repositories/twilio.repository";
import {
  processTwilioInboundWebhook,
  twilioIdempotencyKey,
  verifyTwilioSignature,
} from "@/server/twilio/inbound";
import { getTwilioWebhookUrl } from "@/lib/twilio/config";

export const runtime = "nodejs";

function parseFormBody(raw: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of raw.split("&")) {
    const [key, value] = part.split("=");
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
  }
  return params;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const params = parseFormBody(rawBody);
  const accountSid = params.AccountSid;

  const account = accountSid
    ? await twilioRepository.findByAccountSid(accountSid)
    : null;

  const authToken = account
    ? await twilioRepository.getDecryptedAuthToken(account).catch(() => null)
    : null;

  const signature = request.headers.get("x-twilio-signature");
  const webhookUrl = getTwilioWebhookUrl();
  const signatureValid = verifyTwilioSignature(
    authToken ?? "",
    signature,
    webhookUrl,
    params
  );

  const idempotencyKey = twilioIdempotencyKey(params);

  const existingLog = await prisma.webhookLog.findUnique({
    where: {
      provider_idempotencyKey: {
        provider: "TWILIO",
        idempotencyKey,
      },
    },
  });

  if (existingLog?.status === "PROCESSED") {
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const log = await prisma.webhookLog.upsert({
    where: {
      provider_idempotencyKey: {
        provider: "TWILIO",
        idempotencyKey,
      },
    },
    create: {
      organizationId: account?.organizationId,
      connectedAccountId: account?.id,
      provider: "TWILIO",
      eventType: "twilio_inbound",
      signatureValid,
      idempotencyKey,
      payload: params as object,
      status: "PENDING",
    },
    update: {
      signatureValid,
      payload: params as object,
    },
  });

  if (authToken && !signatureValid) {
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: "Invalid Twilio signature",
      },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    await processTwilioInboundWebhook(params);
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorMessage: message },
    });
    console.error("[twilio/webhook]", message);
  }

  return new NextResponse("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
