"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/integrations/gmail", label: "Gmail" },
  { href: "/integrations/whatsapp", label: "WhatsApp" },
  { href: "/automations", label: "Automations" },
  { href: "/ai-extraction", label: "AI Extraction" },
  { href: "/scheduler", label: "Scheduler" },
  { href: "/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex flex-1 flex-col gap-0.5">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-2 py-1.5 text-sm transition-colors",
            isActive(pathname, item.href)
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
