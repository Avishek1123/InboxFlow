import { Syne } from "next/font/google";
import { HeaderAuth } from "@/components/auth/header-auth";
import { InboxFlowLogo } from "@/components/brand/inboxflow-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-marketing-display",
  weight: ["500", "600", "700"],
});

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${syne.variable} min-h-dvh overflow-x-hidden bg-background text-foreground lg:h-dvh lg:overflow-hidden`}
    >
      <header className="absolute inset-x-0 top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
          <InboxFlowLogo href="/" className="min-w-0" />
          <nav className="flex shrink-0 items-center gap-1.5 sm:gap-3 text-sm">
            <ThemeToggle />
            <HeaderAuth />
          </nav>
        </div>
      </header>
      <main className="lg:h-full">{children}</main>
    </div>
  );
}
