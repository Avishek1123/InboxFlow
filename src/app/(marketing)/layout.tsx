import { Syne } from "next/font/google";
import { HeaderAuth } from "@/components/auth/header-auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { APP_NAME } from "@/lib/constants";

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
      className={`${syne.variable} min-h-dvh bg-[#05060a] text-white`}
    >
      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/5 bg-[#05060a]/30 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="font-[family-name:var(--font-marketing-display)] text-sm font-semibold tracking-tight text-white"
          >
            {APP_NAME}
          </a>
          <nav className="flex items-center gap-3 text-sm">
            <ThemeToggle />
            <HeaderAuth />
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
