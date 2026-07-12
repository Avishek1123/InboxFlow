"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  isTheme,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";
import {
  runThemeTransition,
  type ThemeTransitionOrigin,
} from "@/lib/theme-transition";

type ThemeContextValue = {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme, origin?: ThemeTransitionOrigin) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    setResolved(applyThemeToDocument(stored));
    setReady(true);
  }, []);

  const setTheme = useCallback((next: Theme, origin?: ThemeTransitionOrigin) => {
    const apply = () => {
      flushSync(() => {
        setThemeState(next);
        setResolved(applyThemeToDocument(next));
      });
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    };

    runThemeTransition(apply, origin);
  }, []);

  useEffect(() => {
    if (!ready || theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setResolved(applyThemeToDocument("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, ready]);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
