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
    <div className={`${syne.variable} h-dvh overflow-hidden bg-background text-foreground`}>
      <header className="absolute inset-x-0 top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <InboxFlowLogo href="/" />
          <nav className="flex items-center gap-3 text-sm">
            <ThemeToggle />
            <HeaderAuth />
          </nav>
        </div>
      </header>
      <main className="h-full">{children}</main>
    </div>
  );
}
