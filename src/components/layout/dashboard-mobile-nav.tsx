"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const mobileNav = [
  { href: "/create", label: "Ask AI" },
  { href: "/automations", label: "Workflows" },
  { href: "/settings", label: "Settings" },
] as const;

export function DashboardMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 md:hidden">
      {mobileNav.map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/create" && pathname === "/dashboard") ||
          (item.href !== "/create" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
