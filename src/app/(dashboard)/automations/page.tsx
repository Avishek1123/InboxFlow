import { AutomationList } from "@/features/automations/components/automation-list";
import { requireOrganization } from "@/server/organizations/require-organization";

export default async function AutomationsPage() {
  const { organization } = await requireOrganization();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <AutomationList organizationId={organization.id} />
    </div>
  );
}
