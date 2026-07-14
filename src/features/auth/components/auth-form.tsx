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

  if (code === "auth/invalid-api-key" || code === "auth/api-key-not-valid") {
    return (
      "Invalid Firebase API key. In Google Cloud → APIs & Services → Credentials, " +
      "open your Browser key, ensure Identity Toolkit API is allowed, and add " +
      "http://localhost:3000/* to HTTP referrers. Values must match Firebase Console → Project settings → Your apps."
    );
  }

  if (code === "auth/user-token-expired" || code === "auth/invalid-user-token") {
    return "Your sign-in session expired. Refresh the page and sign in again.";
  }

  if (code === "auth/configuration-not-found") {
    const provider =
      method === "phone"
        ? "Phone"
        : method === "email"
          ? "Email/Password"
          : "your sign-in method";
    return `Firebase Authentication is not enabled for ${provider}. Open Firebase Console → Authentication → click Get started → Sign-in method → enable ${provider}.`;
  }

  if (
    code === "auth/network-request-failed" ||
    (err instanceof Error &&
      /ERR_CONNECTION|Failed to fetch|NetworkError|network/i.test(err.message))
  ) {
    return (
      "Could not reach Google sign-in (network blocked or closed). Check your internet, " +
      "disable VPN/ad-blocker for this site, and confirm Identity Toolkit API is enabled " +
      "in Google Cloud for this Firebase project."
    );
  }

  if (code === "auth/popup-blocked") {
    return "Google sign-in popup was blocked. Allow popups for this site and try again.";
  }

  if (code === "auth/popup-closed-by-user") {
    return "Google sign-in was cancelled. Try again and complete the popup.";
  }

  return err instanceof Error ? err.message : "Authentication failed";
}

type Props = {
  mode: Mode;
  redirectTo?: string;
};

export function AuthForm({ mode, redirectTo = "/create" }: Props) {
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

  const inputClass =
    "w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-400/60 dark:focus:ring-violet-400/50";
  const primaryButtonClass =
    "w-full rounded-full bg-foreground py-2.5 text-sm font-semibold text-background shadow-sm transition hover:opacity-90 disabled:opacity-50";

  return (
    <div className="w-full space-y-4">
      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-background/80 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-muted disabled:opacity-50"
      >
        <GoogleGlyph />
        Continue with Google
      </button>

      <div className="relative py-1 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="relative z-10 bg-transparent px-3 backdrop-blur-sm">
          or use {method === "email" ? "email" : "phone"}
        </span>
        <div className="absolute inset-x-0 top-1/2 border-t border-border/80" />
      </div>

      <div className="flex rounded-full border border-border bg-muted/40 p-1">
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
              "flex-1 rounded-full py-2 text-sm font-medium capitalize transition-all",
              method === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "phone" ? "Phone (+91)" : "Email"}
          </button>
        ))}
      </div>

      {method === "email" ? (
        <form onSubmit={handleEmail} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Email
            </span>
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading
              ? "Please wait…"
              : mode === "sign-up"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      ) : confirmation ? (
        <form onSubmit={verifyOtp} className="space-y-3">
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
            OTP sent to {formatIndianPhone(phone)}
          </p>
          <input
            type="text"
            inputMode="numeric"
            required
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className={cn(inputClass, "text-center text-base tracking-[0.4em]")}
          />
          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? "Verifying…" : "Verify OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={sendOtp} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Phone number
            </span>
            <div className="flex gap-2">
              <span className="flex items-center rounded-xl border border-border bg-muted/60 px-3.5 text-sm font-medium">
                +91
              </span>
              <input
                type="tel"
                required
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={cn(inputClass, "flex-1")}
              />
            </div>
          </label>
          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? "Sending OTP…" : "Send OTP"}
          </button>
        </form>
      )}

      <div id="recaptcha-container" />

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.57-5.17 3.57-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.28a12 12 0 0 0 0 10.76l3.99-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l3.99 3.1C6.22 6.87 8.87 4.76 12 4.76z"
      />
    </svg>
  );
}
