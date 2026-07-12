import type { TwilioMessageChannel } from "@/types/twilio";
import {
  normalizePhone,
  twilioWhatsAppAddress,
} from "@/server/repositories/twilio.repository";

export type TwilioAccountProfile = {
  friendly_name?: string;
  sid?: string;
};

export async function fetchTwilioAccountProfile(
  accountSid: string,
  authToken: string
): Promise<TwilioAccountProfile> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  const body = (await res.json()) as TwilioAccountProfile & {
    message?: string;
  };

  if (!res.ok) {
    throw new Error(
      body.message ??
        `Twilio API error (${res.status}). Check Account SID and auth token.`
    );
  }

  return body;
}

export async function sendTwilioMessage(params: {
  accountSid: string;
  authToken: string;
  channel: TwilioMessageChannel;
  from: string;
  to: string;
  body: string;
}): Promise<{ messageSid?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${params.accountSid}/Messages.json`;
  const auth = Buffer.from(`${params.accountSid}:${params.authToken}`).toString(
    "base64"
  );

  const to =
    params.channel === "whatsapp"
      ? twilioWhatsAppAddress(params.to)
      : normalizePhone(params.to);
  const from =
    params.channel === "whatsapp"
      ? twilioWhatsAppAddress(params.from)
      : normalizePhone(params.from);

  const form = new URLSearchParams({ To: to, From: from, Body: params.body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const data = (await res.json()) as { sid?: string; message?: string };

  if (!res.ok) {
    throw new Error(data.message ?? `Twilio send failed (${res.status})`);
  }

  return { messageSid: data.sid };
}
