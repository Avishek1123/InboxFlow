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

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.push("/");
          router.refresh();
        }}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 hover:bg-zinc-50 sm:px-3 sm:text-sm dark:border-border dark:bg-transparent dark:text-foreground dark:hover:bg-muted"
      >
        Sign out
      </button>
    </div>
  );
}
