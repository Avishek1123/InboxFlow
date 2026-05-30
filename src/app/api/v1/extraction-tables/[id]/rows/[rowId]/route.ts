import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; rowId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { organization } = await requireOrganization();
  const { id, rowId } = await params;

  const table = await extractionTableRepository.getById(id, organization.id);
  if (!table) return apiError("NOT_FOUND", "Table not found", 404);

  const result = await extractionTableRepository.deleteRow(
    rowId,
    id,
    organization.id
  );
  if (result.count === 0) {
    return apiError("NOT_FOUND", "Row not found", 404);
  }
  return apiSuccess({ deleted: true });
}
