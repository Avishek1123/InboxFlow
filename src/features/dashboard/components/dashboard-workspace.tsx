"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { AiDataTablesSection } from "@/features/dashboard/components/ai-data-tables-section";
import type { DashboardOverview as DashboardOverviewData } from "@/server/repositories/dashboard.repository";
import { cn } from "@/lib/utils";

type Tab = "overview" | "data";

type Props = {
  userName: string;
  orgName: string;
  data: DashboardOverviewData;
};

export function DashboardWorkspace({ userName, orgName, data }: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Workspace"
        description="Monitor channels, automations, and extracted data from one place."
      />

      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {(
          [
            { id: "overview" as const, label: "Overview" },
            { id: "data" as const, label: "Data tables" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <DashboardOverview userName={userName} orgName={orgName} data={data} />
      ) : (
        <section className="space-y-4">
          <PageHeader
            size="section"
            title="AI data tables"
            description="Define columns, extract from inbox messages, and export to Google Sheets."
          />
          <AiDataTablesSection />
        </section>
      )}
    </div>
  );
}
