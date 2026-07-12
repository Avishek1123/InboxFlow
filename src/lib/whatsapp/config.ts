export function getWhatsAppGraphVersion(): string {
  return process.env.WHATSAPP_GRAPH_API_VERSION ?? "v21.0";
}

export function getWhatsAppWebhookUrl(): string {
  const base =
    process.env.WHATSAPP_WEBHOOK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/v1/webhooks/whatsapp`;
  return base.replace(/\/$/, "");
}

export function isPlatformWebhookSecretConfigured(): boolean {
  return Boolean(
    process.env.META_APP_SECRET ?? process.env.WHATSAPP_APP_SECRET
  );
}
