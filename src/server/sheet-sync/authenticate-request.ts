import { hashSheetSyncApiKey } from "@/lib/sheet-sync/api-key";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";

export async function authenticateSheetSyncRequest(request: Request) {
  const auth = request.headers.get("authorization");
  const headerKey = request.headers.get("x-inboxflow-api-key");
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("apiKey");

  let rawKey: string | null = null;
  if (auth?.startsWith("Bearer ")) {
    rawKey = auth.slice(7).trim();
  } else if (headerKey) {
    rawKey = headerKey.trim();
  } else if (queryKey) {
    rawKey = queryKey.trim();
  }

  if (!rawKey) return null;

  const hash = hashSheetSyncApiKey(rawKey);
  const export_ = await sheetExportRepository.findByApiKeyHash(hash);
  if (!export_) return null;

  return export_;
}
