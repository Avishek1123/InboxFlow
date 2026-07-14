import Link from "next/link";
import { AuthForm } from "@/features/auth/components/auth-form";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { FirebaseSetupNotice } from "@/components/auth/firebase-setup-notice";

export const metadata = { title: "Sign in" };

type Props = {
  searchParams: Promise<{ redirect?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const { redirect, error } = await searchParams;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="font-[family-name:var(--font-marketing-display)] text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-violet-300/80">
          Welcome back
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-marketing-display)] text-2xl font-semibold tracking-tight">
          Sign in to InboxFlow
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Back to your automated workflows
        </p>
      </div>
      {error === "workspace" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Could not load your workspace. Sign in again after the latest deploy
          finishes (database migration may still be applying).
        </p>
      )}
      {isFirebaseConfigured() ? (
        <AuthForm mode="sign-in" redirectTo={redirect ?? "/create"} />
      ) : (
        <FirebaseSetupNotice />
      )}
      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link
          href="/sign-up"
          className="font-semibold text-foreground underline underline-offset-4 hover:opacity-80"
        >
          Create one free
        </Link>
      </p>
    </div>
  );
}
