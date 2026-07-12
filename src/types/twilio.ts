export type TwilioConnectInput = {
  accountSid: string;
  authToken: string;
  smsPhoneNumber: string;
  whatsappPhoneNumber?: string;
};

export type TwilioAccountSummary = {
  id: string;
  accountSid: string;
  smsPhoneNumber: string;
  whatsappPhoneNumber: string | null;
  status: string;
  webhookUrl: string;
};

export type TwilioStatusResponse = {
  configured: {
    encryption: boolean;
  };
  account: TwilioAccountSummary | null;
};

export type TwilioMessageChannel = "sms" | "whatsapp";
