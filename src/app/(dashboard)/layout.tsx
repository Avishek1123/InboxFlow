import Link from "next/link";
import { UserMenu } from "@/components/auth/user-menu";
import { DashboardMobileNav } from "@/components/layout/dashboard-mobile-nav";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { APP_NAME } from "@/lib/constants";
import { requireOrganization } from "@/server/organizations/require-organization";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { organization } = await requireOrganization();

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden h-full w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar p-4 md:flex">
        <Link href="/dashboard" className="shrink-0 text-sm font-semibold tracking-tight">
          {APP_NAME}
        </Link>
        <p className="mt-1 shrink-0 truncate text-xs text-muted-foreground">
          {organization.name}
        </p>
        <DashboardNav />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
          <p className="text-sm font-semibold md:hidden">{APP_NAME}</p>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>
        <DashboardMobileNav />
        <main className="scrollbar-subtle flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
