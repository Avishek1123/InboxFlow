"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import {
  FIREBASE_PROJECT_STORAGE_KEY,
  validateFirebaseClientConfig,
} from "@/lib/firebase/validate-config";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
  refreshSession: (user: User) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistSession(user: User) {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ??
        "Could not save your session. Check .env and restart the dev server."
    );
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  const refreshSession = useCallback(async (u: User) => {
    await persistSession(u);
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    if (configured) {
      await firebaseSignOut(getFirebaseAuth());
    }
    setUser(null);
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const configIssues = validateFirebaseClientConfig();
    if (configIssues.length > 0) {
      console.warn("[Firebase config]", configIssues.join(" "));
    }

    const auth = getFirebaseAuth();
    let cancelled = false;

    async function initAuth() {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
      if (typeof window !== "undefined" && projectId) {
        const previous = localStorage.getItem(FIREBASE_PROJECT_STORAGE_KEY);
        if (previous && previous !== projectId) {
          await firebaseSignOut(auth);
          await fetch("/api/auth/session", { method: "DELETE" });
        }
        localStorage.setItem(FIREBASE_PROJECT_STORAGE_KEY, projectId);
      }

      const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        if (cancelled) return;

        if (firebaseUser) {
          try {
            await firebaseUser.getIdToken(true);
            setUser(firebaseUser);
            try {
              await persistSession(firebaseUser);
            } catch {
              /* session API may fail if admin not configured yet */
            }
          } catch (err) {
            console.warn("[Firebase] Stale session cleared:", err);
            await firebaseSignOut(auth);
            await fetch("/api/auth/session", { method: "DELETE" });
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      return unsub;
    }

    let unsub: (() => void) | undefined;
    void initAuth().then((u) => {
      unsub = u;
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [configured]);

  const value = useMemo(
    () => ({ user, loading, configured, signOut, refreshSession }),
    [user, loading, configured, signOut, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
