import { runSheetSyncPipeline } from "@/server/sync-pipeline/run-sheet-sync-pipeline";

export type PostGmailSyncPipelineResult = Awaited<
  ReturnType<typeof runSheetSyncPipeline>
>;

/** After Gmail sync: extract into linked tables and push sheets. */
export async function runPostGmailSyncPipeline(
  organizationId: string,
  options?: { extractLimit?: number; messageIds?: string[] }
) {
  return runSheetSyncPipeline(organizationId, options);
}
