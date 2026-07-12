import { prisma } from "@/server/db";
import { interpolateObject } from "../template";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleSendWhatsapp(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );

  const to = String(config.to ?? "").replace(/\D/g, "");
  const body = String(config.body ?? "");

  const account = await prisma.connectedAccount.findFirst({
    where: {
      organizationId: params.organizationId,
      provider: "WHATSAPP",
      status: "ACTIVE",
    },
  });

  if (account) {
    await prisma.whatsAppOutboundJob.create({
      data: {
        organizationId: params.organizationId,
        connectedAccountId: account.id,
        type: "TEXT",
        recipientPhone: to,
        payload: { type: "text", text: { body } },
      },
    });
    const { processWhatsAppOutboundJobs } = await import(
      "@/server/whatsapp/outbound"
    );
    processWhatsAppOutboundJobs(params.organizationId, 5).catch(console.error);
  }

  const output = {
    to,
    body,
    queued: Boolean(account),
    message: account
      ? "WhatsApp job queued"
      : "No active WhatsApp account — message logged only",
  };

  return { output, variables: { lastWhatsAppSent: output } };
}
