import Link from "next/link";
import { AuthForm } from "@/features/auth/components/auth-form";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { FirebaseSetupNotice } from "@/components/auth/firebase-setup-notice";

export const metadata = { title: "Sign in" };

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function SignInPage({ searchParams }: Props) {
  const { redirect } = await searchParams;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Email, Google, or Indian phone (+91)
        </p>
      </div>
      {isFirebaseConfigured() ? (
        <AuthForm mode="sign-in" redirectTo={redirect ?? "/create"} />
      ) : (
        <FirebaseSetupNotice />
      )}
      <p className="text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/sign-up" className="text-primary underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
