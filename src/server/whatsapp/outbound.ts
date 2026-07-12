import type { ConnectedAccount } from "@prisma/client";
import { sendWhatsAppTextMessage } from "@/server/whatsapp/graph";
import { prisma } from "@/server/db";
import { whatsappRepository } from "@/server/repositories/whatsapp.repository";

export async function processWhatsAppOutboundJobs(
  organizationId?: string,
  limit = 20
) {
  const jobs = await prisma.whatsAppOutboundJob.findMany({
    where: {
      status: "PENDING",
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { connectedAccount: true },
  });

  const results: Array<{ jobId: string; ok: boolean; error?: string }> = [];

  for (const job of jobs) {
    if (job.connectedAccount.status !== "ACTIVE") {
      await prisma.whatsAppOutboundJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: "WhatsApp account not active",
        },
      });
      results.push({ jobId: job.id, ok: false, error: "inactive account" });
      continue;
    }

    try {
      const messageId = await sendJob(job.connectedAccount, job);
      await prisma.whatsAppOutboundJob.update({
        where: { id: job.id },
        data: {
          status: "SENT",
          externalMessageId: messageId ?? null,
          sentAt: new Date(),
          lastError: null,
        },
      });
      results.push({ jobId: job.id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      await prisma.whatsAppOutboundJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: msg,
          retryCount: { increment: 1 },
        },
      });
      results.push({ jobId: job.id, ok: false, error: msg });
    }
  }

  return results;
}

async function sendJob(
  account: ConnectedAccount,
  job: { recipientPhone: string; payload: unknown }
): Promise<string | undefined> {
  const accessToken = await whatsappRepository.getDecryptedAccessToken(account);
  const payload = job.payload as {
    type?: string;
    text?: { body?: string };
  };
  const body =
    payload.text?.body ??
    (typeof job.payload === "object" &&
    job.payload &&
    "body" in (job.payload as object)
      ? String((job.payload as { body: string }).body)
      : "");

  const result = await sendWhatsAppTextMessage({
    phoneNumberId: account.externalAccountId,
    accessToken,
    to: job.recipientPhone,
    body,
  });
  return result.messageId;
}
