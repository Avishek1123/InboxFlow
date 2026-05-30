import type { ConnectedAccount } from "@prisma/client";
import { getGmailClientForAccount } from "@/server/gmail/client";

function toBase64Url(str: string): string {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailMessage(
  account: ConnectedAccount,
  params: { to: string; subject: string; body: string; inReplyTo?: string }
) {
  const gmail = await getGmailClientForAccount(account);
  const from = account.accountEmail;

  const lines = [
    `From: ${from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    ...(params.inReplyTo ? [`In-Reply-To: ${params.inReplyTo}`] : []),
    "",
    params.body,
  ];

  const raw = toBase64Url(lines.join("\r\n"));

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return { messageId: res.data.id };
}
