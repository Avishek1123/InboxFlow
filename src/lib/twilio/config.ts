export function getTwilioWebhookUrl(): string {
  const base =
    process.env.TWILIO_WEBHOOK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/webhooks/twilio`;
  return base.replace(/\/$/, "");
}

export function getTwilioAuthTokenFromEnv(): string | null {
  return process.env.TWILIO_AUTH_TOKEN?.trim() ?? null;
}
