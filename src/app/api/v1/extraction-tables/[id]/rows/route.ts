import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { organization } = await requireOrganization();
  const { id } = await params;

  const table = await extractionTableRepository.getById(id, organization.id);
  if (!table) return apiError("NOT_FOUND", "Table not found", 404);

  const result = await extractionTableRepository.clearRows(id, organization.id);
  return apiSuccess({ deleted: result.count });
}
