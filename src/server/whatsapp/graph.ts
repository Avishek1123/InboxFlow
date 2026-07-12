import { getWhatsAppGraphVersion } from "@/lib/whatsapp/config";

export type PhoneNumberProfile = {
  display_phone_number?: string;
  verified_name?: string;
  id?: string;
};

export async function fetchPhoneNumberProfile(
  phoneNumberId: string,
  accessToken: string
): Promise<PhoneNumberProfile> {
  const version = getWhatsAppGraphVersion();
  const url = new URL(
    `https://graph.facebook.com/${version}/${phoneNumberId}`
  );
  url.searchParams.set(
    "fields",
    "display_phone_number,verified_name,quality_rating"
  );

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = (await res.json()) as PhoneNumberProfile & {
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      body.error?.message ??
        `Meta API error (${res.status}). Check phone number ID and access token.`
    );
  }

  return body;
}

export async function sendWhatsAppTextMessage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<{ messageId?: string }> {
  const version = getWhatsAppGraphVersion();
  const to = params.to.replace(/\D/g, "");
  const res = await fetch(
    `https://graph.facebook.com/${version}/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: params.body },
      }),
    }
  );

  const data = (await res.json()) as {
    messages?: Array<{ id: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Send failed (${res.status})`);
  }

  return { messageId: data.messages?.[0]?.id };
}
