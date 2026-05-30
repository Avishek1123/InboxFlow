"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

export function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/sign-in"
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const label =
    user.displayName ||
    user.email ||
    user.phoneNumber ||
    "Account";

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[140px] truncate text-sm text-muted-foreground sm:inline">
        {label}
      </span>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.push("/");
          router.refresh();
        }}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
      >
        Sign out
      </button>
    </div>
  );
}
