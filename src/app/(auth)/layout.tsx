import Link from "next/link";
import { redirect } from "next/navigation";
import { Syne } from "next/font/google";
import { AdminSetupNotice } from "@/components/auth/admin-setup-notice";
import { InboxFlowLogo } from "@/components/brand/inboxflow-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { GmailIcon } from "@/components/icons/gmail-icon";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { getServerSession } from "@/lib/firebase/server-auth";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-marketing-display",
  weight: ["500", "600", "700"],
});

function SheetsGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#0F9D58"
        d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
      />
      <path fill="#87CEAC" d="M14 2.25V8h5.75L14 2.25z" />
      <path fill="#fff" d="M7.5 11h9v1.4h-9V11zm0 3h9v1.4h-9V14zm0 3h6v1.4h-6V17z" />
    </svg>
  );
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (session) redirect("/create");

  return (
    <div
      className={`${syne.variable} relative min-h-dvh bg-background text-foreground`}
    >
      {/* Hero-style canvas — light */}
      <div
        className="absolute inset-0 dark:hidden"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(99,102,241,0.08), transparent 58%), radial-gradient(ellipse 45% 38% at 85% 75%, rgba(59,130,246,0.06), transparent 55%), linear-gradient(180deg, #f7f8fa 0%, #f4f5f7 50%, #f1f2f4 100%)",
        }}
        aria-hidden
      />
      {/* Hero-style canvas — dark */}
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(76,29,149,0.28), transparent 55%), radial-gradient(ellipse 50% 40% at 85% 75%, rgba(30,64,175,0.18), transparent 50%)",
          backgroundColor: "#05060a",
        }}
        aria-hidden
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(24,24,27,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 hidden opacity-[0.35] dark:block"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
        }}
        aria-hidden
      />

      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          <InboxFlowLogo href="/" className="min-w-0" />
          <ThemeToggle />
        </div>
      </header>

      <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-7xl items-center gap-10 px-4 pb-12 pt-24 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16">
        {/* Brand story panel */}
        <aside className="hidden lg:block">
          <p className="font-[family-name:var(--font-marketing-display)] text-xs font-semibold tracking-[0.28em] text-zinc-500 dark:text-violet-300/80">
            INBOXFLOW AI
          </p>
          <h1 className="mt-4 font-[family-name:var(--font-marketing-display)] text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
            Turn Conversations Into Structured Work
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-muted-foreground">
            Connect Gmail, WhatsApp, and Google Sheets. InboxFlow AI reads your
            messages, extracts what matters, and runs your workflows
            automatically — around the clock.
          </p>

          {/* Mini pipeline visualization */}
          <div className="mt-10 flex items-center gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/90 px-3.5 py-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <GmailIcon size={16} />
                <span className="text-xs font-semibold">Gmail</span>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/90 px-3.5 py-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                <WhatsAppIcon size={16} />
                <span className="text-xs font-semibold">WhatsApp</span>
              </div>
            </div>
            <span className="auth-flow-wire h-px w-8 shrink-0" aria-hidden />
            <div className="flex items-center gap-2 rounded-2xl border border-indigo-300/50 bg-white/90 px-3.5 py-2.5 shadow-[0_12px_32px_rgba(99,102,241,0.14)] backdrop-blur-md dark:border-violet-400/25 dark:bg-white/[0.06]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/15 text-[9px] font-bold text-indigo-600 dark:text-violet-300">
                AI
              </span>
              <span className="text-xs font-semibold">Automate</span>
            </div>
            <span className="auth-flow-wire h-px w-8 shrink-0" aria-hidden />
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/60 bg-white/90 px-3.5 py-2.5 shadow-[0_12px_32px_rgba(16,185,129,0.14)] backdrop-blur-md dark:border-emerald-400/25 dark:bg-white/[0.06]">
              <SheetsGlyph />
              <span className="text-xs font-semibold">Sheets & Workflows</span>
            </div>
          </div>

          <ul className="mt-10 space-y-4">
            {[
              {
                title: "Build workflows from one prompt",
                sub: "Describe the automation in plain English — AI assembles the rest.",
              },
              {
                title: "AI that understands your messages",
                sub: "Extracts leads, orders, and tasks from Gmail and WhatsApp automatically.",
              },
              {
                title: "Everything stays in sync",
                sub: "Google Sheets, notifications, and follow-ups run on their own.",
              },
            ].map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                  ✓
                </span>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-muted-foreground">
                    {f.sub}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-500 dark:text-muted-foreground/70">
            <WhatsAppIcon size={12} />
            <GmailIcon size={12} />
            <span>Conversations in · Structured work out</span>
          </div>
        </aside>

        {/* Auth card */}
        <main className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-zinc-200/90 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] ring-1 ring-zinc-950/5 backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_30px_90px_rgba(0,0,0,0.5)] dark:ring-0">
            <AdminSetupNotice />
            {children}
          </div>
          <p className="mt-5 text-center text-[11px] text-zinc-500 dark:text-muted-foreground/70">
            By continuing you agree to the{" "}
            <Link href="/" className="underline hover:text-foreground">
              terms
            </Link>{" "}
            &{" "}
            <Link href="/" className="underline hover:text-foreground">
              privacy policy
            </Link>
            .
          </p>
        </main>
      </div>
    </div>
  );
}
