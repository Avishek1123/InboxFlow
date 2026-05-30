import { AutomationList } from "@/features/automations/components/automation-list";
import { requireOrganization } from "@/server/organizations/require-organization";

export default async function AutomationsPage() {
  const { organization } = await requireOrganization();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Visual workflow builder — connect triggers to actions like Zapier.
        </p>
      </div>
      <AutomationList organizationId={organization.id} />
    </div>
  );
}
