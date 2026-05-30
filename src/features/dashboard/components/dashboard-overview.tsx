import Link from "next/link";
import type { DashboardOverview } from "@/server/repositories/dashboard.repository";
import { cn } from "@/lib/utils";

type Props = {
  userName: string;
  orgName: string;
  data: DashboardOverview;
};

export function DashboardOverview({ userName, orgName, data }: Props) {
  const { stats, integrations, recentConversations, recentExecutions, messagesByDay } =
    data;

  const integrationsConnected =
    Number(integrations.gmail.connected) + Number(integrations.whatsapp.connected);
  const setupComplete = integrationsConnected === 2;
  const isNewWorkspace =
    stats.conversations === 0 &&
    stats.totalAutomations === 0 &&
    stats.aiExtractions7d === 0;

  const maxMessages = Math.max(...messagesByDay.map((d) => d.count), 1);

  return (
    <div className="w-full space-y-8 pb-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-zinc-50 via-white to-zinc-100 p-6 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {formatToday()}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {greeting()}, {userName}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              {orgName} — unified Gmail & WhatsApp inbox with AI and automations.
            </p>
          </div>
          {!setupComplete && (
            <div className="shrink-0 rounded-xl border border-border bg-background/80 px-4 py-3 backdrop-blur sm:min-w-[200px]">
              <p className="text-xs font-medium text-muted-foreground">
                Setup progress
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(integrationsConnected / 2) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums">
                  {integrationsConnected}/2
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Connect channels to unlock your inbox
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Getting started */}
      {isNewWorkspace && (
        <section className="rounded-2xl border border-dashed border-border p-6">
          <h2 className="text-sm font-semibold">Getting started</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete these steps to get the most out of InboxFlow.
          </p>
          <ol className="mt-4 space-y-3">
            <SetupStep
              done={integrations.gmail.connected}
              title="Connect Gmail"
              description="Sync email threads into your unified inbox."
              href="/integrations/gmail"
            />
            <SetupStep
              done={integrations.whatsapp.connected}
              title="Connect WhatsApp Business"
              description="Receive and reply to WhatsApp messages."
              href="/integrations/whatsapp"
            />
            <SetupStep
              done={stats.totalAutomations > 0}
              title="Create your first automation"
              description="Automate replies, routing, and data capture."
              href="/automations"
            />
            <SetupStep
              done={stats.aiExtractions7d > 0}
              title="Try AI extraction"
              description="Summarize messages and extract structured data."
              href="/ai-extraction"
            />
          </ol>
        </section>
      )}

      {/* Stats */}
      <section>
        <h2 className="sr-only">Overview metrics</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Conversations"
            value={stats.conversations}
            hint="Active threads"
            href="/inbox"
          />
          <StatCard
            label="Messages"
            value={stats.messages7d}
            hint="Last 7 days"
            href="/inbox"
          />
          <StatCard
            label="Automations"
            value={stats.activeAutomations}
            hint={`${stats.totalAutomations} total · ${stats.executions24h} runs today`}
            href="/automations"
          />
          <StatCard
            label="AI analyses"
            value={stats.aiExtractions7d}
            hint="Last 7 days"
            href="/ai-extraction"
          />
        </div>
      </section>

      {/* Chart + automation health */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-border p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Message activity</h2>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium tabular-nums">
              {stats.messages7d} total
            </span>
          </div>
          <div className="mt-6 flex h-32 items-end justify-between gap-2">
            {messagesByDay.map((day) => (
              <div
                key={day.label}
                className="flex flex-1 flex-col items-center gap-2"
              >
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    className={cn(
                      "w-full max-w-[2rem] rounded-t-md bg-primary/80 transition-all",
                      day.count === 0 && "bg-muted"
                    )}
                    style={{
                      height: `${Math.max(8, (day.count / maxMessages) * 100)}%`,
                      minHeight: day.count > 0 ? undefined : "8px",
                    }}
                    title={`${day.count} messages`}
                  />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border p-5">
          <h2 className="text-sm font-semibold">Automation health</h2>
          <p className="text-xs text-muted-foreground">Last 24 hours</p>
          <dl className="mt-5 space-y-4">
            <HealthRow
              label="Runs"
              value={String(stats.executions24h)}
            />
            <HealthRow
              label="Success rate"
              value={`${Math.round(stats.automationSuccessRate * 100)}%`}
              good={stats.automationSuccessRate >= 0.9}
            />
            <HealthRow
              label="Queued outbound"
              value={String(stats.pendingOutbound)}
              href="/scheduler"
            />
          </dl>
          <Link
            href="/automations"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted"
          >
            Manage automations
          </Link>
        </section>
      </div>

      {/* Integrations */}
      <section>
        <h2 className="text-sm font-semibold">Channels</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Connect accounts to sync conversations
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <IntegrationCard
            name="Gmail"
            description="Email threads, labels, and attachments"
            href="/integrations/gmail"
            connected={integrations.gmail.connected}
            detail={integrations.gmail.email}
            accent="gmail"
          />
          <IntegrationCard
            name="WhatsApp"
            description="Business API messages and templates"
            href="/integrations/whatsapp"
            connected={integrations.whatsapp.connected}
            detail={integrations.whatsapp.displayName}
            accent="whatsapp"
          />
        </div>
      </section>

      {/* Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityPanel
          title="Recent conversations"
          href="/inbox"
          linkLabel="Open inbox"
          empty={
            <>
              <p>No conversations yet.</p>
              <p className="mt-2">
                <Link href="/integrations/gmail" className="font-medium text-foreground underline">
                  Connect Gmail
                </Link>
                {" or "}
                <Link href="/integrations/whatsapp" className="font-medium text-foreground underline">
                  WhatsApp
                </Link>
                {" to start."}
              </p>
            </>
          }
          isEmpty={recentConversations.length === 0}
        >
          <ul className="divide-y divide-border">
            {recentConversations.map((c) => (
              <li key={c.id}>
                <Link href="/inbox" className="flex gap-3 px-4 py-3 hover:bg-muted/60">
                  <ChannelIcon channel={c.channel} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {c.subject ?? c.participantName ?? "Conversation"}
                      </p>
                      {c.lastMessageAt && (
                        <time className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelative(c.lastMessageAt)}
                        </time>
                      )}
                    </div>
                    {c.snippet && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {c.snippet}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </ActivityPanel>

        <ActivityPanel
          title="Automation runs"
          href="/automations"
          linkLabel="View all"
          empty={
            <>
              <p>No automation runs yet.</p>
              <p className="mt-2">
                <Link href="/automations" className="font-medium text-foreground underline">
                  Create a workflow
                </Link>{" "}
                to automate your inbox.
              </p>
            </>
          }
          isEmpty={recentExecutions.length === 0}
        >
          <ul className="divide-y divide-border">
            {recentExecutions.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.automationName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelative(e.startedAt)}
                  </p>
                </div>
                <StatusBadge status={e.status} />
              </li>
            ))}
          </ul>
        </ActivityPanel>
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-semibold">Quick actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/automations"
            title="New automation"
            description="Build a visual workflow"
          />
          <QuickAction
            href="/ai-extraction"
            title="AI playground"
            description="Summarize & extract data"
          />
          <QuickAction
            href="/integrations/gmail"
            title="Gmail setup"
            description="OAuth & sync settings"
          />
          <QuickAction
            href="/settings"
            title="Settings"
            description="Workspace preferences"
          />
        </div>
      </section>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-background p-5 transition-colors hover:border-foreground/20 hover:bg-muted/30"
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground/70">
        {hint} →
      </p>
    </Link>
  );
}

function IntegrationCard({
  name,
  description,
  href,
  connected,
  detail,
  accent,
}: {
  name: string;
  description: string;
  href: string;
  connected: boolean;
  detail: string | null;
  accent: "gmail" | "whatsapp";
}) {
  const accentBar =
    accent === "gmail"
      ? "bg-gradient-to-r from-red-500/80 to-red-400/40"
      : "bg-gradient-to-r from-emerald-500/80 to-emerald-400/40";

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-border bg-background transition-shadow hover:shadow-md"
    >
      <div className={cn("h-1", accentBar)} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
              connected
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-muted text-muted-foreground"
            )}
          >
            {connected ? "Live" : "Setup"}
          </span>
        </div>
        <p className="mt-4 truncate text-sm text-muted-foreground">
          {detail ?? "Not connected — tap to configure"}
        </p>
        <p className="mt-3 text-xs font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {connected ? "Manage connection →" : "Connect now →"}
        </p>
      </div>
    </Link>
  );
}

function ActivityPanel({
  title,
  href,
  linkLabel,
  empty,
  isEmpty,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  empty: React.ReactNode;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link
          href={href}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {linkLabel} →
        </Link>
      </div>
      {isEmpty ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">{empty}</div>
      ) : (
        children
      )}
    </section>
  );
}

function SetupStep({
  done,
  title,
  description,
  href,
}: {
  done: boolean;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          done
            ? "bg-emerald-600 text-white"
            : "border border-border bg-muted text-muted-foreground"
        )}
      >
        {done ? "✓" : ""}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={href} className="text-sm font-medium hover:underline">
          {title}
        </Link>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}

function HealthRow({
  label,
  value,
  good,
  href,
}: {
  label: string;
  value: string;
  good?: boolean;
  href?: string;
}) {
  const content = (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-lg font-semibold tabular-nums",
          good && "text-emerald-600 dark:text-emerald-400"
        )}
      >
        {value}
      </dd>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center justify-between hover:opacity-80">
        {content}
      </Link>
    );
  }

  return <div className="flex items-center justify-between">{content}</div>;
}

function ChannelIcon({ channel }: { channel: string }) {
  const isWa = channel === "WHATSAPP";
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        isWa
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      )}
    >
      {isWa ? "WA" : "G"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    RUNNING: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  };

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        styles[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border p-4 transition-colors hover:bg-muted/50"
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </Link>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
