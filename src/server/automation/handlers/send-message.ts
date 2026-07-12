import { handleSendSms, handleSendTwilioWhatsapp } from "./send-twilio";
import { handleSendWhatsapp } from "./send-whatsapp";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleSendMessage(
  params: HandlerParams
): Promise<HandlerResult> {
  const option = String(
    (params.node.config as Record<string, unknown>).messagingOption ??
      "meta_whatsapp"
  );

  switch (option) {
    case "meta_whatsapp":
      return handleSendWhatsapp(params);
    case "twilio_sms":
      return handleSendSms(params);
    case "twilio_whatsapp":
      return handleSendTwilioWhatsapp(params);
    default:
      throw new Error(`Unknown messaging option: ${option}`);
  }
}
