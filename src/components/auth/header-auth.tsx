"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { UserMenu } from "./user-menu";

export function HeaderAuth() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return <UserMenu />;
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
        Sign in
      </Link>
      <Link
        href="/sign-up"
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Get started
      </Link>
    </div>
  );
}
