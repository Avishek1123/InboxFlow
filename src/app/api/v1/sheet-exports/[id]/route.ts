import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { requireOrganization } from "@/server/organizations/require-organization";
import { sheetExportRepository } from "@/server/repositories/sheet-export.repository";

export const runtime = "nodejs";

const patchSchema = z.object({
  spreadsheetUrl: z.string().url().optional().nullable(),
  label: z.string().max(120).optional(),
  sheetTitle: z.string().min(1).max(120).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { organization } = await requireOrganization();
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
  }

  const existing = await sheetExportRepository.getById(id, organization.id);
  if (!existing) return apiError("NOT_FOUND", "Export not found", 404);

  await sheetExportRepository.update(id, organization.id, parsed.data);
  const item = await sheetExportRepository.getById(id, organization.id);
  return apiSuccess({ item });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { organization } = await requireOrganization();
  const { id } = await params;
  await sheetExportRepository.delete(id, organization.id);
  return apiSuccess({ deleted: true });
}
