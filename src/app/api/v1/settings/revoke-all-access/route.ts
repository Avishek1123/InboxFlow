import { apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";
import { twilioRepository } from "@/server/repositories/twilio.repository";
import { whatsappRepository } from "@/server/repositories/whatsapp.repository";
import { prisma } from "@/server/db";

export const runtime = "nodejs";

/**
 * Revoke / disconnect every integration for the current organization:
 * Gmail (revokes Google OAuth tokens), WhatsApp, Twilio, and sheet export links.
 */
export async function POST() {
  const { organization } = await requireOrganization();
  const orgId = organization.id;

  const removed: string[] = [];

  const gmail = await gmailRepository.findGmailAccount(orgId);
  if (gmail) {
    await gmailRepository.disconnect(gmail.id);
    removed.push("gmail");
  }

  const whatsapp = await whatsappRepository.findWhatsAppAccount(orgId);
  if (whatsapp && whatsapp.status !== "DISCONNECTED") {
    await whatsappRepository.disconnect(whatsapp.id);
    removed.push("whatsapp");
  }

  const twilio = await twilioRepository.findTwilioAccount(orgId);
  if (twilio && twilio.status !== "DISCONNECTED") {
    await twilioRepository.disconnect(twilio.id);
    removed.push("twilio");
  }

  // Any other connected accounts for this org (safety net).
  const leftover = await prisma.connectedAccount.findMany({
    where: {
      organizationId: orgId,
      status: { not: "DISCONNECTED" },
    },
    select: { id: true, provider: true },
  });
  for (const row of leftover) {
    if (row.provider === "GMAIL") {
      await gmailRepository.disconnect(row.id);
    } else if (row.provider === "WHATSAPP") {
      await whatsappRepository.disconnect(row.id);
    } else if (row.provider === "TWILIO") {
      await twilioRepository.disconnect(row.id);
    } else {
      await prisma.connectedAccount.update({
        where: { id: row.id },
        data: {
          status: "DISCONNECTED",
          encryptedAccessToken: null,
          encryptedRefreshToken: null,
          tokenExpiresAt: null,
          scopes: [],
          syncError: null,
        },
      });
    }
    if (!removed.includes(row.provider.toLowerCase())) {
      removed.push(row.provider.toLowerCase());
    }
  }

  const exports = await sheetExportRepository.list(orgId);
  let sheetsRemoved = 0;
  for (const exp of exports) {
    await sheetExportRepository.delete(exp.id, orgId);
    sheetsRemoved += 1;
  }
  if (sheetsRemoved > 0) removed.push("google_sheets");

  return apiSuccess({
    revoked: true,
    removed,
    sheetsRemoved,
    message:
      "All InboxFlow access for this workspace was removed. You can reconnect from Ask AI or Workflows when needed. To fully revoke Google access, also remove InboxFlow at https://myaccount.google.com/permissions",
  });
}
