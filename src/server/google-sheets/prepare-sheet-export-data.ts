import { backfillMissingTableRows } from "@/server/extraction-tables/backfill-missing-rows";
import { syncGmailAccount } from "@/server/gmail/sync";
import { gmailRepository } from "@/server/repositories/gmail.repository";
import { prisma } from "@/server/db";

const GMAIL_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

export type PrepareSheetExportDataResult = {
  gmailSynced: boolean;
  messagesFetched: number;
  extraction: Awaited<ReturnType<typeof backfillMissingTableRows>>;
};

/**
 * Ensure starred (trigger-filtered) mail is in the DB and extracted into the table
 * before Apps Script or server push reads rows.
 */
export async function prepareSheetExportData(params: {
  organizationId: string;
  extractionTableId: string;
  /** Force Gmail sync even if recently synced (Sync now from website). */
  forceGmailSync?: boolean;
}): Promise<PrepareSheetExportDataResult> {
  const account = await gmailRepository.findGmailAccount(params.organizationId);
  const gmailCount = await prisma.message.count({
    where: { organizationId: params.organizationId, channel: "GMAIL" },
  });

  const lastSyncMs = account?.lastSyncedAt?.getTime() ?? 0;
  const stale = Date.now() - lastSyncMs > GMAIL_SYNC_MIN_INTERVAL_MS;
  const needsGmailSync =
    params.forceGmailSync || gmailCount === 0 || stale;

  let gmailSynced = false;
  let messagesFetched = 0;

  if (needsGmailSync && account?.status === "ACTIVE") {
    try {
      const syncResult = await syncGmailAccount(account, {
        bypassLock: Boolean(params.forceGmailSync),
      });
      gmailSynced = true;
      messagesFetched = syncResult.stats.messagesFetched;
    } catch (err) {
      console.error("[prepare-sheet-export] gmail sync", err);
    }
  }

  const extraction = await backfillMissingTableRows(
    params.extractionTableId,
    params.organizationId,
    params.forceGmailSync
      ? { maxRounds: 8, batchSize: 40 }
      : undefined
  );

  return { gmailSynced, messagesFetched, extraction };
}
