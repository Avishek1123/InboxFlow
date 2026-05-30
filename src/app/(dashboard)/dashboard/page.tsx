import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { AiDataTablesSection } from "@/features/dashboard/components/ai-data-tables-section";
import { getDashboardOverview } from "@/server/repositories/dashboard.repository";
import { requireOrganization } from "@/server/organizations/require-organization";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user, organization } = await requireOrganization();
  const data = await getDashboardOverview(organization.id);

  const userName =
    user.firstName ?? user.email.split("@")[0] ?? "there";

  return (
    <div className="space-y-8">
      <DashboardOverview
        userName={userName}
        orgName={organization.name}
        data={data}
      />
      <AiDataTablesSection />
    </div>
  );
}
