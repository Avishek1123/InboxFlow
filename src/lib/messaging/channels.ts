/**
 * Messaging channel registry — single source of truth for automation nodes
 * and integration requirements.
 */

export type MessagingChannel = "whatsapp" | "sms";

export type MessagingProvider = "meta" | "twilio";

export type MessagingOption = {
  id: `${MessagingProvider}_${MessagingChannel}`;
  provider: MessagingProvider;
  channel: MessagingChannel;
  label: string;
  description: string;
  integration: "WHATSAPP" | "TWILIO";
  color: string;
};

export const MESSAGING_OPTIONS: MessagingOption[] = [
  {
    id: "meta_whatsapp",
    provider: "meta",
    channel: "whatsapp",
    label: "WhatsApp (Meta)",
    description: "WhatsApp Cloud API via Meta Business",
    integration: "WHATSAPP",
    color: "#25d366",
  },
  {
    id: "twilio_sms",
    provider: "twilio",
    channel: "sms",
    label: "SMS (Twilio)",
    description: "Text messages via Twilio",
    integration: "TWILIO",
    color: "#f22f46",
  },
  {
    id: "twilio_whatsapp",
    provider: "twilio",
    channel: "whatsapp",
    label: "WhatsApp (Twilio)",
    description: "WhatsApp via Twilio Messaging API",
    integration: "TWILIO",
    color: "#25d366",
  },
];

export function getMessagingOption(
  id: string
): MessagingOption | undefined {
  return MESSAGING_OPTIONS.find((o) => o.id === id);
}

export function integrationForMessaging(id: string): "WHATSAPP" | "TWILIO" | undefined {
  return getMessagingOption(id)?.integration;
}
