"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/create", label: "Ask AI", hint: "Prompt → ready product" },
  { href: "/automations", label: "Workflows", hint: "Edit & monitor flows" },
  { href: "/settings", label: "Settings", hint: "Account preferences" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/create") {
    return pathname === "/create" || pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-3 py-2.5 transition-colors",
            isActive(pathname, item.href)
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
          )}
        >
          <span className="block text-sm font-medium">{item.label}</span>
          <span className="mt-0.5 block text-[11px] text-zinc-500">
            {item.hint}
          </span>
        </Link>
      ))}
    </nav>
  );
}
