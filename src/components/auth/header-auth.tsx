"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { UserMenu } from "./user-menu";

export function HeaderAuth() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    router.prefetch("/create");
  }, [user, router]);

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-3">
        <Link
          href="/create"
          prefetch
          onMouseEnter={() => router.prefetch("/create")}
          className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 sm:px-3.5 sm:text-sm"
        >
          Dashboard
        </Link>
        <UserMenu />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/sign-in"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className="rounded-lg bg-foreground px-3.5 py-1.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        Get started
      </Link>
    </div>
  );
}
