"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User, ConfirmationResult } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";
type Method = "email" | "phone";

function formatAuthError(err: unknown, method?: Method): string {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";

  if (code === "auth/configuration-not-found") {
    const provider =
      method === "phone"
        ? "Phone"
        : method === "email"
          ? "Email/Password"
          : "your sign-in method";
    return `Firebase Authentication is not enabled for ${provider}. Open Firebase Console → Authentication → click Get started → Sign-in method → enable ${provider}.`;
  }

  return err instanceof Error ? err.message : "Authentication failed";
}

type Props = {
  mode: Mode;
  redirectTo?: string;
};

export function AuthForm({ mode, redirectTo = "/dashboard" }: Props) {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  async function afterAuth(user: User) {
    try {
      await refreshSession(user);
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Signed in with Firebase but server session failed."
      );
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const cred =
        mode === "sign-up"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      await afterAuth(cred.user);
    } catch (err) {
      setError(formatAuthError(err, "email"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await afterAuth(cred.user);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  function formatIndianPhone(input: string): string {
    const digits = input.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    if (input.startsWith("+")) return input;
    return `+91${digits}`;
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(
          auth,
          "recaptcha-container",
          { size: "invisible" }
        );
      }
      const e164 = formatIndianPhone(phone);
      const result = await signInWithPhoneNumber(
        auth,
        e164,
        recaptchaRef.current
      );
      setConfirmation(result);
    } catch (err) {
      setError(formatAuthError(err, "phone"));
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmation) return;
    setLoading(true);
    setError(null);
    try {
      const cred = await confirmation.confirm(otp);
      await afterAuth(cred.user);
    } catch (err) {
      setError(formatAuthError(err, "phone"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex rounded-lg border border-border p-1">
        {(["email", "phone"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMethod(m);
              setError(null);
              setConfirmation(null);
            }}
            className={cn(
              "flex-1 rounded-md py-2 text-sm font-medium capitalize",
              method === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "phone" ? "Phone (+91)" : "Email"}
          </button>
        ))}
      </div>

      {method === "email" ? (
        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading
              ? "Please wait…"
              : mode === "sign-up"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      ) : confirmation ? (
        <form onSubmit={verifyOtp} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            OTP sent to {formatIndianPhone(phone)}
          </p>
          <input
            type="text"
            inputMode="numeric"
            required
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={sendOtp} className="space-y-3">
          <div className="flex gap-2">
            <span className="flex items-center rounded-md border border-border bg-muted px-3 text-sm">
              +91
            </span>
            <input
              type="tel"
              required
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Sending OTP…" : "Send OTP"}
          </button>
        </form>
      )}

      <div id="recaptcha-container" />

      <div className="relative py-2 text-center text-xs text-muted-foreground">
        <span className="bg-background px-2">or</span>
        <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        Continue with Google
      </button>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
