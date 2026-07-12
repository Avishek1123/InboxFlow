import { prisma } from "@/server/db";
import { interpolateObject } from "../template";
import { sendTwilioMessage } from "@/server/twilio/graph";
import { twilioRepository } from "@/server/repositories/twilio.repository";
import type { TwilioMessageChannel } from "@/types/twilio";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleSendTwilio(
  params: HandlerParams,
  defaultChannel: TwilioMessageChannel
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );

  const channel = (String(config.channel ?? defaultChannel) === "whatsapp"
    ? "whatsapp"
    : "sms") as TwilioMessageChannel;
  const to = String(config.to ?? "").replace(/\s/g, "");
  const body = String(config.body ?? "");

  const account = await prisma.connectedAccount.findFirst({
    where: {
      organizationId: params.organizationId,
      provider: "TWILIO",
      status: "ACTIVE",
    },
  });

  if (!account) {
    return {
      output: {
        channel,
        to,
        body,
        queued: false,
        message: "No active Twilio account — message logged only",
      },
      variables: { lastTwilioSent: { channel, to, body, queued: false } },
    };
  }

  const authToken = await twilioRepository.getDecryptedAuthToken(account);
  const from =
    channel === "whatsapp"
      ? twilioRepository.getWhatsAppFromNumber(account)
      : twilioRepository.getSmsFromNumber(account);

  if (!from) {
    throw new Error(
      channel === "whatsapp"
        ? "Twilio WhatsApp sender number not configured — add it in Integrations → Twilio"
        : "Twilio SMS sender number missing"
    );
  }

  const result = await sendTwilioMessage({
    accountSid: account.externalAccountId,
    authToken,
    channel,
    from,
    to,
    body,
  });

  const output = {
    channel,
    to,
    body,
    queued: true,
    messageSid: result.messageSid,
    message: "Twilio message sent",
  };

  return { output, variables: { lastTwilioSent: output } };
}

export async function handleSendSms(
  params: HandlerParams
): Promise<HandlerResult> {
  return handleSendTwilio(params, "sms");
}

export async function handleSendTwilioWhatsapp(
  params: HandlerParams
): Promise<HandlerResult> {
  return handleSendTwilio(params, "whatsapp");
}
