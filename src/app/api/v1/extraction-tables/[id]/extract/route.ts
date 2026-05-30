import { apiError, apiSuccess } from "@/lib/api-response";
import { populateTableFromInbox } from "@/server/extraction-tables/populate-from-inbox";
import { requireOrganization } from "@/server/organizations/require-organization";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { organization } = await requireOrganization();
  const { id } = await params;

  const table = await extractionTableRepository.getById(id, organization.id);
  if (!table) return apiError("NOT_FOUND", "Table not found", 404);

  let forceRefresh = false;
  let limit = 20;
  try {
    const body = await request.json();
    forceRefresh = Boolean(body?.forceRefresh);
    if (typeof body?.limit === "number") limit = Math.min(body.limit, 50);
  } catch {
    /* empty body ok */
  }

  try {
    const result = await populateTableFromInbox(id, organization.id, {
      limit,
      forceRefresh,
    });
    const rows = await extractionTableRepository.listRows(id, organization.id);
    return apiSuccess({ ...result, rows });
  } catch (err) {
    return apiError(
      "EXTRACT_FAILED",
      err instanceof Error ? err.message : "Extraction failed",
      500
    );
  }
}
