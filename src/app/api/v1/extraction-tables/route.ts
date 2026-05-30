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

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  columns: z.array(columnSchema).min(1),
});

export async function GET() {
  const { organization } = await requireOrganization();
  const items = await extractionTableRepository.list(organization.id);
  return apiSuccess({ items });
}

export async function POST(request: Request) {
  const { organization } = await requireOrganization();
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid body", 400, parsed.error.flatten());
  }

  const columns = normalizeColumns(parsed.data.columns);
  const table = await extractionTableRepository.create({
    organizationId: organization.id,
    name: parsed.data.name,
    description: parsed.data.description,
    columns,
  });

  return apiSuccess({
    item: {
      id: table.id,
      name: table.name,
      description: table.description,
      columns,
      rowCount: 0,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
    },
  });
}
