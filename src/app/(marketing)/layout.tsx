import { HeaderAuth } from "@/components/auth/header-auth";
import { APP_NAME } from "@/lib/constants";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">
            {APP_NAME}
          </span>
          <nav className="flex items-center gap-4 text-sm">
            <a
              href="#features"
              className="text-muted-foreground hover:text-foreground"
            >
              Features
            </a>
            <HeaderAuth />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </footer>
    </div>
  );
}
