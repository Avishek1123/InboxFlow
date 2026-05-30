import Link from "next/link";
import { AuthForm } from "@/features/auth/components/auth-form";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { FirebaseSetupNotice } from "@/components/auth/firebase-setup-notice";

export const metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Works with Indian +91 phone numbers
        </p>
      </div>
      {isFirebaseConfigured() ? (
        <AuthForm mode="sign-up" />
      ) : (
        <FirebaseSetupNotice />
      )}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-primary underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
