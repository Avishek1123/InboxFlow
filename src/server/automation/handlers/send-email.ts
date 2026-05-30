import { prisma } from "@/server/db";
import { sendGmailMessage } from "@/server/gmail/send";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import { interpolateObject } from "../template";
import type { HandlerParams, HandlerResult } from "./index";

export async function handleSendEmail(
  params: HandlerParams
): Promise<HandlerResult> {
  const config = interpolateObject(
    params.node.config as Record<string, unknown>,
    params.context
  );

  const to = String(config.to ?? "");
  const subject = String(config.subject ?? "(no subject)");
  const body = String(config.body ?? "");

  const account = await gmailRepository.findGmailAccount(
    params.organizationId
  );

  if (account?.status === "ACTIVE") {
    try {
      const sent = await sendGmailMessage(account, { to, subject, body });
      return {
        output: { status: "sent", ...sent, to, subject },
        variables: { lastEmailSent: { to, subject } },
      };
    } catch (err) {
      console.error("[SEND_EMAIL]", err);
    }
  }

  const job = {
    type: "SEND_EMAIL" as const,
    to,
    subject,
    body,
    organizationId: params.organizationId,
    status: "queued",
    note: account ? "Send failed — queued for retry" : "Connect Gmail to send",
  };

  await prisma.automationDataRecord.create({
    data: {
      organizationId: params.organizationId,
      automationId: params.automationId,
      executionId: params.executionId,
      key: `email_queue:${params.executionId}`,
      value: job,
    },
  });

  return {
    output: job,
    variables: { lastEmailSent: { to, subject } },
  };
}
