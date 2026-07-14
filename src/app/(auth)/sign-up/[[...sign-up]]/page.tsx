import Link from "next/link";
import { AuthForm } from "@/features/auth/components/auth-form";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { FirebaseSetupNotice } from "@/components/auth/firebase-setup-notice";

export const metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="font-[family-name:var(--font-marketing-display)] text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-violet-300/80">
          Start free
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-marketing-display)] text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Automate Gmail, WhatsApp & Sheets with AI in minutes
        </p>
      </div>
      {isFirebaseConfigured() ? (
        <AuthForm mode="sign-up" />
      ) : (
        <FirebaseSetupNotice />
      )}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-semibold text-foreground underline underline-offset-4 hover:opacity-80"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
