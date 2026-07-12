import { AutomationBuilder } from "@/features/automations/components/automation-builder";
import { requireOrganization } from "@/server/organizations/require-organization";

type Props = { params: Promise<{ id: string }> };

export default async function AutomationEditorPage({ params }: Props) {
  const { id } = await params;
  const { organization } = await requireOrganization();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <AutomationBuilder organizationId={organization.id} automationId={id} />
    </div>
  );
}
