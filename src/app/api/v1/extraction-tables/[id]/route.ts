import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { normalizeColumns } from "@/server/ai/custom-table-extract";
import { requireOrganization } from "@/server/organizations/require-organization";
import { extractionTableRepository } from "@/server/repositories/extraction-table.repository";

export const runtime = "nodejs";

const columnSchema = z.object({
  label: z.string().min(1),
  hint: z.string().optional(),
  key: z.string().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  columns: z.array(columnSchema).min(1).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { organization } = await requireOrganization();
  const { id } = await params;
  const table = await extractionTableRepository.getById(id, organization.id);
  if (!table) return apiError("NOT_FOUND", "Table not found", 404);
  const rows = await extractionTableRepository.listRows(id, organization.id);
  return apiSuccess({ table, rows });
}

export async function PATCH(request: Request, { params }: Params) {
  const { organization } = await requireOrganization();
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
  }

  const existing = await extractionTableRepository.getById(id, organization.id);
  if (!existing) return apiError("NOT_FOUND", "Table not found", 404);

  await extractionTableRepository.update(id, organization.id, {
    name: parsed.data.name,
    description: parsed.data.description,
    columns: parsed.data.columns
      ? normalizeColumns(parsed.data.columns)
      : undefined,
  });

  const table = await extractionTableRepository.getById(id, organization.id);
  return apiSuccess({ table });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { organization } = await requireOrganization();
  const { id } = await params;
  await extractionTableRepository.delete(id, organization.id);
  return apiSuccess({ deleted: true });
}
